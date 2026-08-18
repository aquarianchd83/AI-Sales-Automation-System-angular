import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
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
  canDeleteCampaign,
  canRunCampaignJobs,
} from '../../../core/models/campaign.model';
import { CampaignFormDialogComponent, CampaignFormDialogData } from '../campaign-form-dialog/campaign-form-dialog.component';
import { CampaignService } from '../../../core/services/campaign.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';
import { RunJobsResultDialogComponent } from '../run-jobs-result-dialog/run-jobs-result-dialog.component';

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
  readonly canDelete = canDeleteCampaign;
  readonly canRunJobsFor = canRunCampaignJobs;
  readonly endDate = campaignEndDate;
  readonly statusLegend = CAMPAIGN_STATUS_ORDER;
  readonly statusDescription = CAMPAIGN_STATUS_DESCRIPTIONS;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<Campaign> = emptyPage<Campaign>();
  loading = true;
  runningJobs = false;
  /** Campaign ids with a per-row job currently in flight — tracked per-row rather than one
   * flag so running one campaign's job doesn't disable every other row's button too. */
  private readonly runningJobIds = new Set<string>();

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly campaigns: CampaignService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
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

  create(): void {
    this.openForm({ mode: 'create' });
  }

  view(campaign: Campaign): void {
    void this.router.navigate([campaign.id], { relativeTo: this.route });
  }

  delete(campaign: Campaign, event: Event): void {
    event.stopPropagation();
    const data: ConfirmDialogData = {
      title: `Delete "${campaign.name}"?`,
      message:
        'This cannot be undone. Only Draft and Stopped campaigns can be deleted — deleting a Stopped campaign also permanently deletes its message history.',
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.campaigns.delete(campaign.id).subscribe(() => {
          this.notify.success('Campaign deleted.');
          this.reload$.next();
        });
      });
  }

  isRunningJob(campaignId: string): boolean {
    return this.runningJobIds.has(campaignId);
  }

  /** Same send pipeline as runJobsNow, scoped to just this row's campaign — open to any
   * authenticated user, unlike the global trigger, since it can't touch anyone else's campaign. */
  runJobForCampaign(campaign: Campaign, event: Event): void {
    event.stopPropagation();
    this.runningJobIds.add(campaign.id);
    this.campaigns
      .runJobsForCampaign(campaign.id)
      .pipe(finalize(() => this.runningJobIds.delete(campaign.id)))
      .subscribe({
        next: (result) => {
          this.dialog.open(RunJobsResultDialogComponent, { data: { result }, width: '480px' });
          this.reload$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** SuperAdmin only — the menu item is hidden for anyone else via *appHasRole. */
  runJobsNow(): void {
    this.runningJobs = true;
    this.campaigns
      .runJobsNow()
      .pipe(finalize(() => (this.runningJobs = false)))
      .subscribe({
        next: (result) => {
          this.dialog.open(RunJobsResultDialogComponent, { data: { result }, width: '480px' });
          this.reload$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
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
