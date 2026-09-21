import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { AuditLogEntry, AuditLogQuery, formatChanges } from '../../core/models/audit-log.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../core/models/paged-result.model';
import { AuditLogService } from '../../core/services/audit-log.service';

/** An `<input type="date">` value (yyyy-MM-dd) as the start or end of that local day, in UTC. */
function dayBoundary(value: string, end: boolean): string | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

@Component({
  selector: 'app-audit-log',
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.scss'],
})
export class AuditLogComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['performedAt', 'performedBy', 'entity', 'action', 'expand'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly filters = new FormGroup({
    search: new FormControl<string>('', { nonNullable: true }),
    entityName: new FormControl<string>('', { nonNullable: true }),
    action: new FormControl<string>('', { nonNullable: true }),
    from: new FormControl<string>('', { nonNullable: true }),
    to: new FormControl<string>('', { nonNullable: true }),
  });

  page: PagedResult<AuditLogEntry> = emptyPage<AuditLogEntry>();
  loading = true;
  failed = false;
  expandedId: string | null = null;

  readonly formatChanges = formatChanges;

  private pageIndex = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly auditLog: AuditLogService) {}

  ngOnInit(): void {
    this.filters.valueChanges.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.pageIndex = 1;
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          this.failed = false;
          return this.auditLog.getPaged(this.buildQuery()).pipe(
            catchError(() => {
              this.failed = true;
              return of(emptyPage<AuditLogEntry>(this.pageSize));
            }),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => {
        this.page = page;
        this.expandedId = null;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.reload$.next();
  }

  toggle(entry: AuditLogEntry): void {
    this.expandedId = this.expandedId === entry.id ? null : entry.id;
  }

  clearFilters(): void {
    this.filters.reset();
  }

  get hasFilters(): boolean {
    return Object.values(this.filters.getRawValue()).some((v) => !!v);
  }

  private buildQuery(): AuditLogQuery {
    const f = this.filters.getRawValue();
    return {
      page: this.pageIndex,
      pageSize: this.pageSize,
      search: f.search.trim() || undefined,
      entityName: f.entityName.trim() || undefined,
      action: f.action.trim() || undefined,
      from: dayBoundary(f.from, false),
      to: dayBoundary(f.to, true),
    };
  }
}
