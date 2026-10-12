import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';

import { QUOTA_TYPE_ICONS, QUOTA_TYPE_LABELS, QuotaType, formatUnits } from '../../../core/models/billing.model';
import {
  STUDIO_ACTIVITY_KIND_LABELS,
  STUDIO_ACTIVITY_STATUS_LABELS,
  STUDIO_APPROVAL_POLICY_LABELS,
  StudioActivity,
  StudioActivityKind,
  StudioActivityStatus,
  StudioApprovalPolicy,
  StudioOverview,
  StudioUsageTotal,
} from '../../../core/models/content-studio.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';

/** How far back the activity list looks. `null` days means everything. */
interface PeriodOption {
  label: string;
  days: number | null;
}

/** One balance card: what is left, plus what the last 30 days did to it. */
interface StudioBalanceView {
  type: QuotaType;
  balance: number;
  capacity: number;
  percentLeft: number;
  level: 'none' | 'ok' | 'low' | 'empty';
  totals: StudioUsageTotal | null;
}

/**
 * The tenant's record of every AI Content Studio charge: how much of each studio quota is left, what each step cost, what
 * came back when something failed, and what was refused for lack of credits. The list is on the left; clicking a row
 * opens its full detail on the right, so the tenant never leaves the page to find out what a charge was for.
 */
@Component({
  selector: 'app-studio-activity',
  templateUrl: './studio-activity.component.html',
  styleUrls: ['./studio-activity.component.scss'],
})
export class StudioActivityComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly typeLabels = QUOTA_TYPE_LABELS;
  readonly typeIcons = QUOTA_TYPE_ICONS;
  readonly kindLabels = STUDIO_ACTIVITY_KIND_LABELS;
  readonly statusLabels = STUDIO_ACTIVITY_STATUS_LABELS;
  readonly policyLabels = STUDIO_APPROVAL_POLICY_LABELS;
  readonly formatUnits = formatUnits;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly columns = ['when', 'activity', 'quota', 'units', 'balance', 'status'];
  readonly statusEnum = StudioActivityStatus;

  readonly kinds = Object.values(StudioActivityKind).filter((v): v is StudioActivityKind => typeof v === 'number');
  readonly statuses = Object.values(StudioActivityStatus).filter((v): v is StudioActivityStatus => typeof v === 'number');
  readonly studioQuotaTypes = [QuotaType.ContentGenerations, QuotaType.VideoRenders];
  readonly policies = [StudioApprovalPolicy.AdminOnly, StudioApprovalPolicy.AdminAndSalesManager];
  readonly periods: PeriodOption[] = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'All time', days: null },
  ];

  readonly search = new FormControl('', { nonNullable: true });
  readonly policy = new FormControl<StudioApprovalPolicy>(StudioApprovalPolicy.AdminOnly, { nonNullable: true });

  overview: StudioOverview | null = null;
  balances: StudioBalanceView[] = [];
  activity: PagedResult<StudioActivity> = emptyPage<StudioActivity>();
  selected: StudioActivity | null = null;

  period: PeriodOption = this.periods[1];
  kindFilter: StudioActivityKind | null = null;
  statusFilter: StudioActivityStatus | null = null;
  quotaFilter: QuotaType | null = null;

  loadingOverview = true;
  loadingActivity = true;
  savingSettings = false;

  private page = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly studio: ContentStudioService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.studio
      .getOverview()
      .pipe(finalize(() => (this.loadingOverview = false)))
      .subscribe({
        next: (overview) => {
          this.overview = overview;
          this.policy.reset(overview.approvalPolicy);
          this.balances = overview.balances.map((b) => this.toView(b, overview.last30Days));
        },
      });

    this.loadActivity();

    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => this.resetAndLoad());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get enabled(): boolean {
    return !this.overview || this.overview.enabled;
  }

  get hasFilters(): boolean {
    return this.kindFilter != null || this.statusFilter != null || this.quotaFilter != null || !!this.search.value.trim() || this.period.days !== 30;
  }

  onFilterChange(): void {
    this.resetAndLoad();
  }

  clearFilters(): void {
    this.kindFilter = null;
    this.statusFilter = null;
    this.quotaFilter = null;
    this.period = this.periods[1];
    this.search.setValue('', { emitEvent: false });
    this.resetAndLoad();
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadActivity();
  }

  select(row: StudioActivity): void {
    this.selected = this.selected?.id === row.id ? null : row;
  }

  /** What the step cost in the end, in words a tenant reads at a glance. */
  unitsLabel(row: StudioActivity): string {
    if (row.status === StudioActivityStatus.Blocked) {
      return 'Not charged';
    }
    if (row.units === 0) {
      return 'Free';
    }
    if (row.unitsRefunded >= row.units) {
      return `0 (${formatUnits(row.units)} refunded)`;
    }
    return `−${formatUnits(row.netUnits)}`;
  }

  /** Methods rather than indexing the label maps in the template - a *matCellDef row isn't narrowed. */
  typeLabel(type: QuotaType): string {
    return QUOTA_TYPE_LABELS[type];
  }

  statusLabel(status: StudioActivityStatus): string {
    return STUDIO_ACTIVITY_STATUS_LABELS[status];
  }

  statusClass(status: StudioActivityStatus): string {
    return `status status--${StudioActivityStatus[status].toLowerCase()}`;
  }

  policyDirty(): boolean {
    return !!this.overview && this.policy.value !== this.overview.approvalPolicy;
  }

  saveSettings(): void {
    if (this.savingSettings || !this.policyDirty()) {
      return;
    }

    this.savingSettings = true;
    this.studio
      .updateSettings({ approvalPolicy: this.policy.value })
      .pipe(finalize(() => (this.savingSettings = false)))
      .subscribe((saved) => {
        if (this.overview) {
          this.overview = { ...this.overview, approvalPolicy: saved.approvalPolicy };
        }
        this.notify.success('Approval setting saved.');
      });
  }

  private resetAndLoad(): void {
    this.page = 1;
    this.paginator?.firstPage();
    this.loadActivity();
  }

  private loadActivity(): void {
    this.loadingActivity = true;
    const from = this.period.days == null ? null : new Date(Date.now() - this.period.days * 86_400_000).toISOString();
    this.studio
      .getActivity({
        page: this.page,
        pageSize: this.pageSize,
        search: this.search.value.trim() || undefined,
        kind: this.kindFilter,
        status: this.statusFilter,
        quotaType: this.quotaFilter,
        fromUtc: from,
      })
      .pipe(finalize(() => (this.loadingActivity = false)))
      .subscribe({
        next: (page) => {
          this.activity = page;
          // Keep the open detail only while its row is still on the page.
          this.selected = this.selected ? page.items.find((r) => r.id === this.selected?.id) ?? null : null;
        },
      });
  }

  private toView(balance: StudioOverview['balances'][number], totals: StudioUsageTotal[]): StudioBalanceView {
    const capacity = balance.capacity;
    const percentLeft = capacity > 0 ? Math.min(100, (balance.balance / capacity) * 100) : 0;
    const level: StudioBalanceView['level'] = capacity === 0 ? 'none' : balance.balance <= 0 ? 'empty' : percentLeft <= 20 ? 'low' : 'ok';
    return {
      type: balance.quotaType,
      balance: balance.balance,
      capacity,
      percentLeft,
      level,
      totals: totals.find((t) => t.quotaType === balance.quotaType) ?? null,
    };
  }
}
