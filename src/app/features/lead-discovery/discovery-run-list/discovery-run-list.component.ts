import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { LeadDiscoveryRun } from '../../../core/models/lead-discovery.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';

/** What each lead-discovery run cost and produced, newest first. Admin only, like the profile and
 * spend it sits alongside. */
@Component({
  selector: 'app-discovery-run-list',
  templateUrl: './discovery-run-list.component.html',
  styleUrls: ['./discovery-run-list.component.scss'],
})
export class DiscoveryRunListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['ranAtUtc', 'model', 'rounds', 'candidates', 'saved', 'duplicates', 'rejected', 'cost'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  page: PagedResult<LeadDiscoveryRun> = emptyPage<LeadDiscoveryRun>();
  loading = true;
  failed = false;

  private pageIndex = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly leadDiscovery: LeadDiscoveryService) {}

  ngOnInit(): void {
    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          this.failed = false;
          return this.leadDiscovery.getRuns(this.buildQuery()).pipe(
            catchError(() => {
              this.failed = true;
              return of(emptyPage<LeadDiscoveryRun>(this.pageSize));
            }),
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
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.reload$.next();
  }

  private buildQuery(): PagedQuery {
    return { page: this.pageIndex, pageSize: this.pageSize };
  }
}
