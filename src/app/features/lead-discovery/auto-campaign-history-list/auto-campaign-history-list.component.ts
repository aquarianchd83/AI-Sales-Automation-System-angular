import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { AutoCampaignEnrollment, autoCampaignEnrollmentChipClass } from '../../../core/models/lead-discovery.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';

/** Auto-campaign enrollment outcomes (Started/Skipped/Failed) for discovered customers, newest first -
 * the audit trail behind the Auto campaign section on the discovery profile. Admin only. */
@Component({
  selector: 'app-auto-campaign-history-list',
  templateUrl: './auto-campaign-history-list.component.html',
  styleUrls: ['./auto-campaign-history-list.component.scss'],
})
export class AutoCampaignHistoryListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['createdAt', 'businessName', 'sourceCampaign', 'executionCampaign', 'status'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly chipClass = autoCampaignEnrollmentChipClass;

  page: PagedResult<AutoCampaignEnrollment> = emptyPage<AutoCampaignEnrollment>();
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
          return this.leadDiscovery.getAutoCampaignHistory(this.buildQuery()).pipe(
            catchError(() => {
              this.failed = true;
              return of(emptyPage<AutoCampaignEnrollment>(this.pageSize));
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
