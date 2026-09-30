import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, switchMap, takeUntil } from 'rxjs/operators';

import {
  CAMPAIGN_STEP_OUTCOME_DESCRIPTIONS,
  CampaignStatus,
  CampaignStepDeliverySummary,
  CampaignStepOutcome,
  CampaignStepRecipient,
  formatStepTypeName,
  stepOutcomeChipClass,
  stepOutcomeLabel,
} from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';

interface OutcomeFilter {
  value: string;
  label: string;
  info: string;
}

/** Per-step delivery history for one campaign: pick a step, see who received it, who it failed
 * for, who is still due it and who never will — and resend the failures. */
@Component({
  selector: 'app-campaign-step-delivery',
  templateUrl: './campaign-step-delivery.component.html',
  styleUrls: ['./campaign-step-delivery.component.scss'],
})
export class CampaignStepDeliveryComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  @Input() campaignId = '';
  @Input() campaignStatus: string | null = null;
  /** Bumped by the parent when its own data changed (e.g. Run job now) so this card refetches. */
  @Input() refreshToken = 0;

  readonly displayedColumns = ['customer', 'outcome', 'when', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly chipClass = stepOutcomeChipClass;
  readonly outcomeLabel = stepOutcomeLabel;
  readonly formatStepTypeName = formatStepTypeName;
  readonly outcomeFilters: OutcomeFilter[] = [
    { value: '', label: 'All', info: 'Everyone attached to the campaign, whatever has happened with this step.' },
    ...[
      [CampaignStepOutcome.Failed, 'Failed'],
      [CampaignStepOutcome.Upcoming, 'Will receive'],
      [CampaignStepOutcome.Sent, 'Sent'],
      [CampaignStepOutcome.Delivered, 'Delivered'],
      [CampaignStepOutcome.Read, 'Read'],
      [CampaignStepOutcome.WillNotReceive, 'Will not receive'],
    ].map(([value, label]) => ({
      value,
      label,
      info: CAMPAIGN_STEP_OUTCOME_DESCRIPTIONS[value as CampaignStepOutcome],
    })),
  ];

  summaries: CampaignStepDeliverySummary[] = [];
  selectedStep: number | null = null;
  outcomeFilter = '';
  page: PagedResult<CampaignStepRecipient> = emptyPage<CampaignStepRecipient>();
  loadingSummary = false;
  loadingPage = false;
  failed = false;
  resendingAll = false;

  private pageIndex = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  private readonly retryingIds = new Set<string>();
  private readonly reloadPage$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly campaigns: CampaignService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.reloadPage$
      .pipe(
        switchMap(() => {
          if (!this.campaignId || this.selectedStep === null) {
            return of(emptyPage<CampaignStepRecipient>(this.pageSize));
          }
          this.loadingPage = true;
          this.failed = false;
          return this.campaigns
            .getStepRecipients(
              this.campaignId,
              this.selectedStep,
              { page: this.pageIndex, pageSize: this.pageSize },
              this.outcomeFilter || undefined
            )
            .pipe(
              catchError(() => {
                this.failed = true;
                return of(emptyPage<CampaignStepRecipient>(this.pageSize));
              }),
              finalize(() => (this.loadingPage = false))
            );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));

    this.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const token = changes['refreshToken'];
    if (token && !token.firstChange) {
      this.refresh();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** What the currently selected status filter means, shown under the chips. */
  get selectedFilterInfo(): string {
    return this.outcomeFilters.find((f) => f.value === this.outcomeFilter)?.info ?? '';
  }

  get selectedSummary(): CampaignStepDeliverySummary | null {
    return this.summaries.find((s) => s.stepNumber === this.selectedStep) ?? null;
  }

  /** Failed messages abandon their retry on a non-Running campaign, so resending is Running-only. */
  get canResend(): boolean {
    return this.campaignStatus === CampaignStatus.Running;
  }

  /** Reloads the per-step counts and the open step's list. */
  refresh(): void {
    if (!this.campaignId) {
      return;
    }
    this.loadingSummary = true;
    this.campaigns
      .getStepDelivery(this.campaignId)
      .pipe(finalize(() => (this.loadingSummary = false)))
      .subscribe({
        next: (summaries) => {
          this.summaries = [...summaries].sort((a, b) => a.stepNumber - b.stepNumber);
          const stillThere = this.summaries.some((s) => s.stepNumber === this.selectedStep);
          if (!stillThere) {
            this.selectedStep = this.summaries[0]?.stepNumber ?? null;
          }
          this.reloadPage$.next();
        },
        error: () => {
          this.summaries = [];
          this.selectedStep = null;
          this.failed = true;
        },
      });
  }

  selectStep(stepNumber: number): void {
    if (stepNumber === this.selectedStep) {
      return;
    }
    this.selectedStep = stepNumber;
    this.resetPaging();
  }

  setOutcomeFilter(value: string): void {
    this.outcomeFilter = value;
    this.resetPaging();
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.reloadPage$.next();
  }

  displayName(row: CampaignStepRecipient): string {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
    return name || row.phoneNumberE164;
  }

  /** The most relevant timestamp for the row's outcome (null when there is none to show). */
  whenFor(row: CampaignStepRecipient): string | null {
    return row.readAt ?? row.deliveredAt ?? row.sentAt ?? row.dueAt;
  }

  whenLabel(row: CampaignStepRecipient): string {
    if (row.readAt) return 'Read';
    if (row.deliveredAt) return 'Delivered';
    if (row.sentAt) return 'Sent';
    if (row.dueAt) return 'Due';
    return '';
  }

  isRetrying(messageId: string | null): boolean {
    return !!messageId && this.retryingIds.has(messageId);
  }

  resend(row: CampaignStepRecipient): void {
    if (!row.messageId) {
      return;
    }
    const messageId = row.messageId;
    this.retryingIds.add(messageId);
    this.campaigns
      .retryMessage(this.campaignId, messageId)
      .pipe(finalize(() => this.retryingIds.delete(messageId)))
      .subscribe({
        next: (result) => {
          if (result.sent) {
            this.notify.success('Message resent.');
          } else {
            this.notify.error(`Resend failed: ${result.failureReason ?? 'unknown error'}`);
          }
          this.refresh();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  resendAllFailed(): void {
    if (this.selectedStep === null) {
      return;
    }
    this.resendingAll = true;
    this.campaigns
      .resendFailedForStep(this.campaignId, this.selectedStep)
      .pipe(finalize(() => (this.resendingAll = false)))
      .subscribe({
        next: (result) => {
          if (result.considered === 0) {
            this.notify.info('Nothing to resend.');
          } else {
            this.notify.success(`Resent ${result.sent} of ${result.considered} failed message(s).`);
          }
          this.refresh();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  private resetPaging(): void {
    this.pageIndex = 1;
    this.paginator?.firstPage();
    this.reloadPage$.next();
  }
}
