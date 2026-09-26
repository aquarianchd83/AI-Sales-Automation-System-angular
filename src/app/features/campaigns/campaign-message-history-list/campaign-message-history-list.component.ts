import { ActivatedRoute } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, merge, of } from 'rxjs';
import { catchError, debounceTime, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import {
  CampaignHistoryFilter,
  CampaignMessageHistoryEntry,
  CampaignMessageStatus,
  CampaignStatus,
  CampaignStep,
  campaignMessageStatusChipClass,
  formatStepTypeName,
} from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';

interface StepOption {
  value: number;
  label: string;
}

/** Every message a single campaign has sent — the per-send detail behind the audience roster's
 * status/step summary. Newest first. */
@Component({
  selector: 'app-campaign-message-history-list',
  templateUrl: './campaign-message-history-list.component.html',
  styleUrls: ['./campaign-message-history-list.component.scss'],
})
export class CampaignMessageHistoryListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['createdAt', 'customer', 'step', 'template', 'status', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusChipClass = campaignMessageStatusChipClass;
  readonly formatStepTypeName = formatStepTypeName;
  readonly statusOptions = Object.values(CampaignMessageStatus);

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly statusControl = new FormControl<string>('', { nonNullable: true });
  readonly stepControl = new FormControl<string>('', { nonNullable: true });
  readonly templateControl = new FormControl<string>('', { nonNullable: true });
  readonly fromControl = new FormControl<string>('', { nonNullable: true });
  readonly toControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<CampaignMessageHistoryEntry> = emptyPage<CampaignMessageHistoryEntry>();
  loading = true;
  failed = false;
  campaignStatus: string | null = null;
  stepOptions: StepOption[] = [];
  templateOptions: string[] = [];

  private campaignId = '';
  private pageIndex = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  /** Message ids with a retry currently in flight — tracked per-row so one slow retry doesn't
   * disable every other row's button too. */
  private readonly retryingIds = new Set<string>();
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly campaigns: CampaignService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.campaignId = this.route.snapshot.paramMap.get('id') ?? '';

    this.campaigns.getById(this.campaignId).subscribe({
      next: (campaign) => {
        this.campaignStatus = campaign.status;
        this.stepOptions = this.buildStepOptions(campaign.steps);
        this.templateOptions = this.buildTemplateOptions(campaign.steps);
      },
      error: () => (this.campaignStatus = null),
    });

    merge(
      this.searchControl.valueChanges.pipe(debounceTime(300)),
      this.statusControl.valueChanges,
      this.stepControl.valueChanges,
      this.templateControl.valueChanges,
      this.fromControl.valueChanges,
      this.toControl.valueChanges
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
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
          return this.campaigns.getHistory(this.campaignId, this.buildQuery(), this.buildFilter()).pipe(
            catchError(() => {
              this.failed = true;
              return of(emptyPage<CampaignMessageHistoryEntry>(this.pageSize));
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

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue('');
    this.stepControl.setValue('');
    this.templateControl.setValue('');
    this.fromControl.setValue('');
    this.toControl.setValue('');
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.searchControl.value ||
      this.statusControl.value ||
      this.stepControl.value ||
      this.templateControl.value ||
      this.fromControl.value ||
      this.toControl.value
    );
  }

  displayName(entry: CampaignMessageHistoryEntry): string {
    const name = [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim();
    return name || entry.phoneNumberE164;
  }

  isRetrying(messageId: string): boolean {
    return this.retryingIds.has(messageId);
  }

  /** Only while Running: RetryOneAsync treats a non-Running campaign as a reason to permanently
   * abandon the message (AttemptCount forced to the max), so a retry click on a Paused campaign
   * would burn a message that might otherwise still be worth leaving for the campaign's own resume. */
  canRetry(entry: CampaignMessageHistoryEntry): boolean {
    return entry.status === CampaignMessageStatus.Failed && this.campaignStatus === CampaignStatus.Running;
  }

  retry(entry: CampaignMessageHistoryEntry, event: Event): void {
    event.stopPropagation();
    this.retryingIds.add(entry.messageId);
    this.campaigns
      .retryMessage(this.campaignId, entry.messageId)
      .pipe(finalize(() => this.retryingIds.delete(entry.messageId)))
      .subscribe({
        next: (result) => {
          if (result.sent) {
            this.notify.success('Message resent.');
          } else {
            this.notify.error(`Retry failed: ${result.failureReason ?? 'unknown error'}`);
          }
          this.reload$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  private buildStepOptions(steps: CampaignStep[]): StepOption[] {
    return [...steps]
      .sort((a, b) => a.stepNumber - b.stepNumber)
      .map((s) => ({ value: s.stepNumber, label: formatStepTypeName(s.stepNumber) }));
  }

  private buildTemplateOptions(steps: CampaignStep[]): string[] {
    const names = steps.map((s) => s.messageTemplateName).filter((n): n is string => !!n);
    return [...new Set(names)].sort();
  }

  private buildQuery(): PagedQuery {
    return { page: this.pageIndex, pageSize: this.pageSize, search: this.searchControl.value || undefined };
  }

  private buildFilter(): CampaignHistoryFilter {
    return {
      status: this.statusControl.value || undefined,
      stepNumber: this.stepControl.value ? Number(this.stepControl.value) : undefined,
      templateName: this.templateControl.value || undefined,
      from: this.fromControl.value || undefined,
      to: this.toControl.value || undefined,
    };
  }
}
