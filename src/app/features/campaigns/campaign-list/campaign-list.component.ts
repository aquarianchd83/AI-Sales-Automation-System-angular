import { ActivatedRoute, Router } from '@angular/router';
import { Component, Inject, OnDestroy, OnInit, Optional, ViewChild } from '@angular/core';
import { EMBEDDED_IN_ONBOARDING } from '../../../core/tokens/embedded-in-onboarding';
import { FormControl } from '@angular/forms';
import { CAMPAIGN_JOB_TYPES } from '../../../core/models/tenant-job.model';
import { NotificationHubService } from '../../../core/services/notification-hub.service';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import {
  CAMPAIGN_STATUS_DESCRIPTIONS,
  CAMPAIGN_STATUS_ORDER,
  Campaign,
  campaignEndDate,
  campaignStatusChipClass,
  canRetireCampaign,
} from '../../../core/models/campaign.model';
import { CampaignFormDialogComponent, CampaignFormDialogData } from '../campaign-form-dialog/campaign-form-dialog.component';
import { TenantJobsDialogComponent, TenantJobsDialogData } from '../../../shared/components/tenant-jobs-dialog/tenant-jobs-dialog.component';
import { CampaignRetireDialogComponent } from '../campaign-retire-dialog/campaign-retire-dialog.component';
import { CampaignService } from '../../../core/services/campaign.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-campaign-list',
  templateUrl: './campaign-list.component.html',
  styleUrls: ['./campaign-list.component.scss'],
})
export class CampaignListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = [
    'name',
    'status',
    'audienceCount',
    'scheduledStartAt',
    'startedAt',
    'endDate',
    'createdAt',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusClass = campaignStatusChipClass;
  readonly canRetire = canRetireCampaign;
  readonly endDate = campaignEndDate;
  readonly statusLegend = CAMPAIGN_STATUS_ORDER;
  readonly campaignJobTypes = CAMPAIGN_JOB_TYPES;
  readonly statusDescription = CAMPAIGN_STATUS_DESCRIPTIONS;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<Campaign> = emptyPage<Campaign>();
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly campaigns: CampaignService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly notificationHub: NotificationHubService,
    @Optional() @Inject(EMBEDDED_IN_ONBOARDING) embedded: boolean | null
  ) {
    this.embedded = !!embedded;
  }

  /** Inside onboarding's "Create Campaign" step: just the campaigns. The job schedules are an ongoing-operations
   * concern (and the jobs only exist once a campaign does), so they are left out. */
  readonly embedded: boolean;

  ngOnInit(): void {
    // A campaign job just ran (sends, follow-ups, retries or the completion job): statuses and counts on
    // this grid may have moved, so refetch in place rather than making the user reload the page.
    this.notificationHub
      .jobFinished(CAMPAIGN_JOB_TYPES)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.reload$.next());

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.campaigns.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<Campaign>(this.query.pageSize))),
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

  /** The campaign jobs live in a dialog, opened from the Jobs button, instead of taking up the top of the page. */
  openJobs(): void {
    const data: TenantJobsDialogData = {
      title: 'Campaign jobs',
      description: 'The scheduled jobs that send, follow up, retry and close your campaigns.',
      jobTypes: CAMPAIGN_JOB_TYPES,
    };
    this.dialog.open(TenantJobsDialogComponent, { ...TenantJobsDialogComponent.config, data });
  }

  create(): void {
    this.openForm({ mode: 'create' });
  }

  view(campaign: Campaign): void {
    void this.router.navigate([campaign.id], { relativeTo: this.route });
  }

  viewHistory(campaign: Campaign, event: Event): void {
    event.stopPropagation();
    void this.router.navigate([campaign.id, 'history'], { relativeTo: this.route });
  }

  /** Retiring replaces deleting in the grid: the campaign stays as a record, with the reason, listed last. */
  retire(campaign: Campaign, event: Event): void {
    event.stopPropagation();
    this.dialog
      .open(CampaignRetireDialogComponent, { data: { campaign }, width: '480px', disableClose: true })
      .afterClosed()
      .subscribe((retired) => {
        if (retired) {
          this.reload$.next();
        }
      });
  }

  private openForm(data: CampaignFormDialogData): void {
    this.dialog
      .open(CampaignFormDialogComponent, { data, width: '560px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }
}
