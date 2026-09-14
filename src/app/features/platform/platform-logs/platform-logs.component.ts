import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  finalize,
  map,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  LOG_LEVELS,
  PlatformLogEntry,
  PlatformLogQuery,
  PlatformTenantListItem,
} from '../../../core/models/platform.model';
import { PlatformLogService } from '../../../core/services/platform-log.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';

type TenantOption = Pick<PlatformTenantListItem, 'id' | 'name'>;

/** Messages longer than this, or spanning more than one line (stack traces), start collapsed. */
const PREVIEW_LENGTH = 240;

/** The Levels dropdown's "All" option. Never sent to the API — "All" is simply no level filter. */
export const ALL_LEVELS = 'All';

@Component({
  selector: 'app-platform-logs',
  templateUrl: './platform-logs.component.html',
  styleUrls: ['./platform-logs.component.scss'],
})
export class PlatformLogsComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['timestamp', 'level', 'tenant', 'source', 'message'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly levels = LOG_LEVELS;
  readonly allLevels = ALL_LEVELS;

  readonly tenantSearchControl = new FormControl<string | TenantOption>('', { nonNullable: true });
  readonly dateControl = new FormControl<string>('', { nonNullable: true });
  /** Either exactly [ALL_LEVELS], or one or more specific levels — never both; see normalizeLevels. */
  readonly levelControl = new FormControl<string[]>([ALL_LEVELS], { nonNullable: true });
  readonly moduleControl = new FormControl<string>('', { nonNullable: true });
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  /** Typed text searches tenants; a picked option sets the control to the tenant object, which is
   * filtered out here so selecting one does not fire another search. */
  readonly tenantOptions$: Observable<PlatformTenantListItem[]> = this.tenantSearchControl.valueChanges.pipe(
    startWith(''),
    filter((value): value is string => typeof value === 'string'),
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((search) =>
      this.tenants.getPaged({ search: search.trim() || undefined, pageSize: 10 }).pipe(
        map((page) => page.items),
        catchError(() => of<PlatformTenantListItem[]>([]))
      )
    )
  );

  dates: string[] = [];
  modules: string[] = [];
  selectedTenant: TenantOption | null = null;
  page: PagedResult<PlatformLogEntry> = emptyPage<PlatformLogEntry>();
  loading = true;
  readonly expanded = new Set<PlatformLogEntry>();

  private query: PlatformLogQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  /** The Levels selection as of the last change — needed to tell "All was just ticked" apart from
   * "a level was just ticked while All was already on". */
  private selectedLevels: string[] = [ALL_LEVELS];
  private readonly reload$ = new Subject<void>();
  private readonly modulesFor$ = new Subject<string | undefined>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly logs: PlatformLogService,
    private readonly tenants: PlatformTenantService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // Deep-linked from a tenant's own detail screen ("View logs"), so the list opens already narrowed
    // to that tenant.
    const tenantId = this.route.snapshot.queryParamMap.get('tenantId');
    if (tenantId) {
      this.query = { ...this.query, tenantId };
      this.selectedTenant = { id: tenantId, name: 'this tenant' };
      this.tenants
        .getById(tenantId)
        .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
        .subscribe((tenant) => {
          if (tenant && this.selectedTenant?.id === tenant.id) {
            this.selectedTenant = { id: tenant.id, name: tenant.name };
            this.tenantSearchControl.setValue(this.selectedTenant, { emitEvent: false });
          }
        });
    }

    this.reload$
      .pipe(
        switchMap(() => {
          this.loading = true;
          return this.logs.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformLogEntry>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => {
        this.expanded.clear();
        this.page = page;
      });

    this.modulesFor$
      .pipe(
        switchMap((date) => this.logs.getModules(date).pipe(catchError(() => of<string[]>([])))),
        takeUntil(this.destroy$)
      )
      .subscribe((modules) => (this.modules = modules));

    // Picks the newest date that actually has a file rather than leaving the API to default to
    // "today", which is empty until something has been logged today.
    this.logs
      .getDates()
      .pipe(catchError(() => of<string[]>([])), takeUntil(this.destroy$))
      .subscribe((dates) => {
        this.dates = dates;
        if (dates.length) {
          this.dateControl.setValue(dates[0], { emitEvent: false });
          this.query = { ...this.query, date: dates[0] };
        }
        this.modulesFor$.next(this.query.date);
        this.reload$.next();
      });

    this.dateControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((date) => {
      this.applyFilters({ date: date || undefined });
      this.modulesFor$.next(date || undefined);
    });

    this.levelControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((selected) => {
      const levels = this.normalizeLevels(selected);
      this.selectedLevels = levels;
      if (levels.join() !== selected.join()) {
        this.levelControl.setValue(levels, { emitEvent: false });
      }

      const next = levels.includes(ALL_LEVELS) ? undefined : levels;
      // Unticking the only selected level lands back on All — no change to the filter, so no reload.
      if ((next ?? []).join() !== (this.query.levels ?? []).join()) {
        this.applyFilters({ levels: next });
      }
    });

    this.moduleControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((module) => this.applyFilters({ module: module || undefined }));

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => this.applyFilters({ search: search.trim() || undefined }));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    this.reload$.next();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  onTenantSelected(event: MatAutocompleteSelectedEvent): void {
    const tenant = event.option.value as PlatformTenantListItem;
    this.selectedTenant = { id: tenant.id, name: tenant.name };
    this.applyFilters({ tenantId: tenant.id });
    this.syncTenantQueryParam(tenant.id);
  }

  clearTenant(): void {
    this.selectedTenant = null;
    this.tenantSearchControl.setValue('');
    this.applyFilters({ tenantId: undefined });
    this.syncTenantQueryParam(null);
  }

  tenantDisplay(value: string | TenantOption | null): string {
    return typeof value === 'string' ? value : value?.name ?? '';
  }

  levelClass(level: string): string {
    switch (level) {
      case 'Fatal':
      case 'Error':
        return 'level level--error';
      case 'Warning':
        return 'level level--warning';
      default:
        return 'level';
    }
  }

  /** "WhatsAppSalesAutomation.Application.Conversations.ConversationService" → "ConversationService". */
  shortModule(module: string | null): string {
    return module ? module.substring(module.lastIndexOf('.') + 1) : '';
  }

  isLong(entry: PlatformLogEntry): boolean {
    return /\r?\n/.test(entry.message) || entry.message.length > PREVIEW_LENGTH;
  }

  preview(entry: PlatformLogEntry): string {
    const firstLine = entry.message.split(/\r?\n/, 1)[0];
    return firstLine.length > PREVIEW_LENGTH ? `${firstLine.slice(0, PREVIEW_LENGTH)}…` : firstLine;
  }

  toggle(entry: PlatformLogEntry): void {
    if (this.expanded.has(entry)) {
      this.expanded.delete(entry);
    } else {
      this.expanded.add(entry);
    }
  }

  /**
   * "All" and specific levels are mutually exclusive. Ticking All clears the specific levels; ticking
   * a level while All is on clears All; and unticking everything, or ticking every single level,
   * falls back to All — so the dropdown always says exactly what the list is showing.
   */
  normalizeLevels(selected: string[]): string[] {
    const specific = this.levels.filter((level) => selected.includes(level));
    const allJustTicked = selected.includes(ALL_LEVELS) && !this.selectedLevels.includes(ALL_LEVELS);

    if (allJustTicked || specific.length === 0 || specific.length === this.levels.length) {
      return [ALL_LEVELS];
    }
    return specific;
  }

  private applyFilters(patch: Partial<PlatformLogQuery>): void {
    this.query = { ...this.query, ...patch, page: 1 };
    this.paginator?.firstPage();
    this.reload$.next();
  }

  /** Keeps the tenant in the URL, so a filtered view can be refreshed or shared as a link. */
  private syncTenantQueryParam(tenantId: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tenantId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
