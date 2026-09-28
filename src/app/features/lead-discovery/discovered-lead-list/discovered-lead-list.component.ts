import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, merge, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { DiscoveredLead, MIN_SCORE_FILTERS, leadScoreChipClass } from '../../../core/models/lead-discovery.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { TENANT_ADMIN_ROLES } from '../../../core/models/user.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { DiscoveredLeadDetailDialogComponent } from '../discovered-lead-detail-dialog/discovered-lead-detail-dialog.component';

/** Businesses the lead-discovery job found and qualified, newest first. Read-only — there is no
 * endpoint to convert, dismiss or delete one — so a row opens a detail dialog rather than a page. */
@Component({
  selector: 'app-discovered-lead-list',
  templateUrl: './discovered-lead-list.component.html',
  styleUrls: ['./discovered-lead-list.component.scss'],
})
export class DiscoveredLeadListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['business', 'location', 'contact', 'score', 'discoveredAt'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly minScoreOptions = MIN_SCORE_FILTERS;
  readonly scoreClass = leadScoreChipClass;
  readonly adminRoles = TENANT_ADMIN_ROLES;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly minScoreControl = new FormControl<number | null>(null);

  page: PagedResult<DiscoveredLead> = emptyPage<DiscoveredLead>();
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly leadDiscovery: LeadDiscoveryService,
    private readonly dialog: MatDialog
  ) {}

  get isFiltered(): boolean {
    return !!this.query.search || this.minScoreControl.value != null;
  }

  ngOnInit(): void {
    const search$ = this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      map((search) => ({ search: search.trim() || undefined }))
    );
    const minScore$ = this.minScoreControl.valueChanges.pipe(map(() => ({})));

    merge(search$, minScore$)
      .pipe(takeUntil(this.destroy$))
      .subscribe((change) => {
        this.query = { ...this.query, ...change, page: 1 };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.leadDiscovery.getLeads(this.query, this.minScoreControl.value).pipe(
            catchError(() => of(emptyPage<DiscoveredLead>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.minScoreControl.setValue(null);
  }

  location(lead: DiscoveredLead): string {
    return [lead.city, lead.state].filter(Boolean).join(', ') || '—';
  }

  view(lead: DiscoveredLead): void {
    this.dialog.open(DiscoveredLeadDetailDialogComponent, { data: lead, width: '560px', maxWidth: '95vw' });
  }
}
