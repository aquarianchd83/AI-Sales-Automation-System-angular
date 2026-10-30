import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  PlatformPlan,
  PlatformTenantDetail,
  SUBSCRIPTION_STATUS_LABELS,
  TENANT_STATUS_LABELS,
  TenantStatus,
} from '../../../core/models/platform.model';
import {
  Payment,
  QUOTA_TYPE_LABELS,
  QUOTA_GRANT_ORIGIN_LABELS,
  QuotaBalance,
  QUOTA_ENTRY_ACTION_LABELS,
  QuotaEntryType,
  QuotaLedgerEntry,
  QuotaLedgerSummary,
  RegionOption,
  TimeZoneOption,
  formatCharge,
  formatUnits,
} from '../../../core/models/billing.model';
import { PLATFORM_FEATURES, PLATFORM_FEATURE_LABELS, PlatformFeature } from '../../../core/models/wallet.model';
import { TenantSettingCategory, TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { BillingService } from '../../../core/services/billing.service';
import { ImpersonationSessionService } from '../../../core/services/impersonation-session.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';
import { PlatformRefundService } from '../../../core/services/platform-refund.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformQuotaAdjustDialogComponent } from '../platform-quota-adjust-dialog/platform-quota-adjust-dialog.component';
import { PlatformRefundReviewDialogComponent } from '../platform-refund-review-dialog/platform-refund-review-dialog.component';
import { PlatformTenantConfigOverridesDialogComponent } from '../platform-tenant-config-overrides-dialog/platform-tenant-config-overrides-dialog.component';
import { PlatformTenantJobsDialogComponent } from '../platform-tenant-jobs-dialog/platform-tenant-jobs-dialog.component';
import { PlatformTenantPurgeDialogComponent } from '../platform-tenant-purge-dialog/platform-tenant-purge-dialog.component';
import { PlatformTenantWhatsAppConfigDialogComponent } from '../platform-tenant-whatsapp-config-dialog/platform-tenant-whatsapp-config-dialog.component';

@Component({
  selector: 'app-platform-tenant-detail',
  templateUrl: './platform-tenant-detail.component.html',
  styleUrls: ['./platform-tenant-detail.component.scss'],
})
export class PlatformTenantDetailComponent implements OnInit {
  readonly statusLabels = TENANT_STATUS_LABELS;
  readonly subscriptionStatusLabels = SUBSCRIPTION_STATUS_LABELS;
  /** This page is about one tenant, so its money is shown in that tenant's currency (USD in the tooltip). */
  readonly formatCharge = formatCharge;
  readonly TenantStatus = TenantStatus;
  readonly planControl = new FormControl<string | null>(null);
  readonly timezoneControl = new FormControl<string | null>(null);
  readonly countryControl = new FormControl<string | null>(null);
  readonly stateControl = new FormControl<string>('', { nonNullable: true });

  tenant: PlatformTenantDetail | null = null;
  plans: PlatformPlan[] = [];
  timezones: TimeZoneOption[] = [];
  regions: RegionOption[] = [];
  loading = true;
  impersonating = false;
  savingPlan = false;
  savingTimezone = false;
  savingCountry = false;

  whatsAppConfig: TenantWhatsAppConfig | null = null;
  /** Which WhatsApp connection this tenant is on ('QrBridge' or the Meta Cloud API), reported by the connection-type panel. Decides which setup panel shows. */
  whatsAppProvider: string | null = null;
  providerLoaded = false;
  loadingConfig = true;

  configOverrides: TenantSettingCategory[] = [];
  loadingConfigOverrides = true;

  /** Read-only summary of this tenant's background jobs. Scheduling, pausing and running them lives
   * on the Background Jobs screen (deep-linked below with this tenant pre-selected) rather than being
   * duplicated here - one place owns those actions and their audit entries. */

  readonly quotaLabels = QUOTA_TYPE_LABELS;
  readonly originLabels = QUOTA_GRANT_ORIGIN_LABELS;
  readonly formatUnits = formatUnits;

  /** This tenant's prepaid quota and payments - loaded beside the profile rather than with it, so a slow
   * quota query never holds up the rest of the page. */
  quota: QuotaBalance[] = [];
  loadingQuota = true;
  readonly ledgerColumns = ['processingDate', 'credits', 'unit', 'activity', 'balance'];
  readonly ledgerFeatures = PLATFORM_FEATURES;
  readonly featureLabels = PLATFORM_FEATURE_LABELS;
  ledgerFilter: PlatformFeature | 'Purchased' | 'Used' | '' = '';
  /** The credit history can be limited to a range of days; it narrows the entries, the tiles and the graph alike. */
  readonly fromControl = new FormControl<Date | null>(null);
  readonly toControl = new FormControl<Date | null>(null);
  summary: QuotaLedgerSummary | null = null;
  loadingSummary = true;
  /** The graph's own series: it follows the selected tile, while the tiles keep the whole-history totals. */
  chartDaily: QuotaLedgerSummary['daily'] = [];
  loadingChart = false;
  showEntries = false;
  readonly chartWidth = 640;
  readonly chartHeight = 150;
  readonly ledgerPageSize = 10;
  ledger: QuotaLedgerEntry[] = [];
  ledgerTotal = 0;
  ledgerPage = 1;
  loadingLedger = true;
  payments: Payment[] = [];
  loadingPayments = true;
  togglingRefunds = false;

  tenantId!: string;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tenants: PlatformTenantService,
    private readonly billing: PlatformBillingService,
    private readonly config: PlatformTenantConfigService,
    private readonly timeZoneService: TimeZoneService,
    private readonly billingService: BillingService,
    private readonly impersonation: ImpersonationSessionService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly refundService: PlatformRefundService
  ) {}

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') : '?';
  }

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('id') ?? '';
    this.billing.getPlans().subscribe({ next: (plans) => (this.plans = plans) });
    this.timeZoneService.getTimezones().subscribe({ next: (timezones) => (this.timezones = timezones) });
    this.load();
    this.loadConfig();
    this.loadConfigOverrides();
    this.loadQuota();
    this.loadPayments();
  }

  /** Count of tenant-overridable keys this tenant currently overrides, across all categories - what
   * the "Advanced settings" card's summary line shows. */
  get overrideCount(): number {
    return this.configOverrides.flatMap((c) => c.items).filter((i) => i.overrideValue !== null).length;
  }

  get totalOverridableCount(): number {
    return this.configOverrides.flatMap((c) => c.items).length;
  }

  adjustQuota(): void {
    this.dialog
      .open(PlatformQuotaAdjustDialogComponent, {
        data: { tenantId: this.tenantId, tenantName: this.tenant?.name ?? '' },
        width: '480px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.loadQuota();
        }
      });
  }

  /** The per-tenant refund switch. Off hides the request option from the tenant, and the server refuses it either way. */
  setRefundRequests(enabled: boolean): void {
    if (this.togglingRefunds || !this.tenant) {
      return;
    }
    this.togglingRefunds = true;
    this.refundService
      .setRefundRequestsEnabled(this.tenantId, enabled)
      .pipe(finalize(() => (this.togglingRefunds = false)))
      .subscribe({
        next: () => {
          this.tenant!.refundRequestsEnabled = enabled;
          this.notify.success(enabled ? 'This tenant can now request refunds.' : 'Refund requests turned off for this tenant.');
        },
        error: () => this.load(),
      });
  }

  /** A real charge - not a refund row, and not free. The server still decides whether anything is left to refund. */
  canRefund(payment: Payment): boolean {
    return payment.kind !== 'Refund' && payment.localAmount > 0;
  }

  refundPayment(payment: Payment): void {
    this.dialog
      .open(PlatformRefundReviewDialogComponent, {
        data: { mode: 'direct', payment, tenantId: this.tenantId },
        width: '520px',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.loadPayments();
          this.loadQuota();
        }
      });
  }

  formatPayment(payment: Payment): string {
    const paid = payment.totalLocal ? payment.totalLocal : payment.localAmount;
    const amount = Math.abs(paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${paid < 0 ? '−' : ''}${payment.currencySymbol}${amount}`;
  }

  suspend(): void {
    this.confirmAndRun(
      {
        title: 'Suspend this tenant?',
        message: `${this.tenant?.name} and all its users will be locked out immediately. Their data is untouched, and this is reversible.`,
        confirmLabel: 'Suspend',
        destructive: true,
      },
      () => this.tenants.suspend(this.tenantId),
      'Tenant suspended.'
    );
  }

  reactivate(): void {
    this.confirmAndRun(
      { title: 'Reactivate this tenant?', message: `${this.tenant?.name} will regain access immediately.`, confirmLabel: 'Reactivate' },
      () => this.tenants.reactivate(this.tenantId),
      'Tenant reactivated.'
    );
  }

  delete(): void {
    this.confirmAndRun(
      {
        title: 'Lock this tenant out?',
        message: `${this.tenant?.name} will be locked out. Their data is kept, and you can reactivate them. To remove the tenant and all its data for good, use Delete permanently.`,
        confirmLabel: 'Lock out',
        destructive: true,
      },
      () => this.tenants.delete(this.tenantId),
      'Tenant locked out.'
    );
  }

  onProviderChange(effective: string | null): void {
    this.whatsAppProvider = effective;
    this.providerLoaded = true;
  }

  deletePermanently(): void {
    if (!this.tenant) {
      return;
    }
    const { id, name, slug } = this.tenant;
    this.dialog
      .open(PlatformTenantPurgeDialogComponent, { width: '480px', data: { id, name, slug } })
      .afterClosed()
      .subscribe((purged) => {
        if (purged) {
          this.notify.success(`${name} and all its data were deleted.`);
          void this.router.navigate(['/platform/tenants']);
        }
      });
  }

  impersonate(): void {
    if (this.impersonating) {
      return;
    }
    this.impersonating = true;
    // Opened synchronously, before the HTTP call — see ImpersonationSessionService's own doc
    // comment for why this can't wait until the response comes back.
    const placeholder = this.impersonation.openPlaceholder();
    this.tenants
      .impersonate(this.tenantId)
      .pipe(finalize(() => (this.impersonating = false)))
      .subscribe((session) => {
        if (this.impersonation.send(placeholder, session)) {
          this.notify.info(`Opened a support session as ${session.impersonatedUserEmail} in a new tab.`);
        } else {
          this.notify.error('Your browser blocked the new tab. Allow popups for this site and try again.');
        }
      });
  }

  savePlanOverride(): void {
    const planId = this.planControl.value;
    if (!planId || this.savingPlan) {
      return;
    }
    this.savingPlan = true;
    this.tenants
      .overridePlan(this.tenantId, { planId })
      .pipe(finalize(() => (this.savingPlan = false)))
      .subscribe(() => {
        this.notify.success('Plan updated.');
        this.load();
      });
  }

  saveTimezoneOverride(): void {
    const timezone = this.timezoneControl.value;
    if (!timezone || this.savingTimezone) {
      return;
    }
    this.savingTimezone = true;
    this.tenants
      .updateTimezone(this.tenantId, timezone)
      .pipe(finalize(() => (this.savingTimezone = false)))
      .subscribe(() => {
        this.notify.success('Timezone updated.');
        this.load();
      });
  }

  saveCountryOverride(): void {
    const countryCode = this.countryControl.value;
    if (!countryCode || this.savingCountry) {
      return;
    }
    this.savingCountry = true;
    this.tenants
      .updateCountry(this.tenantId, countryCode, this.stateControl.value)
      .pipe(finalize(() => (this.savingCountry = false)))
      .subscribe(() => {
        this.notify.success('Country updated — plan pricing and tax now follow it.');
        this.load();
      });
  }

  editWhatsAppConfig(): void {
    this.dialog
      .open(PlatformTenantWhatsAppConfigDialogComponent, {
        data: { tenantId: this.tenantId, tenantName: this.tenant?.name ?? '', config: this.whatsAppConfig },
        width: '720px',
        maxWidth: '95vw',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadConfig();
          this.load();
        }
      });
  }

  deleteWhatsAppConfig(): void {
    this.confirmAndRun(
      {
        title: 'Delete WhatsApp configuration?',
        message: `${this.tenant?.name} will go back to "not connected" — outbound messages fall back to the simulated provider until it's reconfigured.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => this.config.deleteWhatsAppConfig(this.tenantId),
      'WhatsApp configuration deleted.',
      () => this.loadConfig()
    );
  }

  editConfigOverrides(): void {
    this.dialog
      .open(PlatformTenantConfigOverridesDialogComponent, {
        data: { tenantId: this.tenantId, tenantName: this.tenant?.name ?? '', categories: this.configOverrides },
        width: '640px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadConfigOverrides();
        }
      });
  }

  resetConfigOverrides(): void {
    this.confirmAndRun(
      {
        title: 'Reset advanced settings?',
        message: `Every Campaigns/Media/Messaging/AI override for ${this.tenant?.name} will be cleared - back to the platform default for all of them.`,
        confirmLabel: 'Reset',
        destructive: true,
      },
      () => this.config.deleteConfigOverrides(this.tenantId),
      'Advanced settings reset to platform defaults.',
      () => this.loadConfigOverrides()
    );
  }

  private load(): void {
    this.loading = true;
    this.tenants.getById(this.tenantId).subscribe({
      next: (tenant) => {
        this.tenant = tenant;
        this.stateControl.setValue(tenant.stateCode ?? '');
        // The countries switched on, plus this tenant's own if it has since been switched off.
        this.billingService.getRegions(tenant.countryCode).subscribe({ next: (regions) => (this.regions = regions) });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        void this.router.navigate(['/platform/tenants']);
      },
    });
  }

  /** Opens this tenant's background jobs in a dialog, so the operator stays on the page. */
  showJobs(): void {
    if (!this.tenant) {
      return;
    }
    this.dialog.open(PlatformTenantJobsDialogComponent, {
      ...PlatformTenantJobsDialogComponent.config,
      data: { tenantId: this.tenantId, tenantName: this.tenant.name },
    });
  }

  /** What happened to the credits, in a word: Purchased, Used, Plan credit, Expired, Refunded... */
  ledgerAction(entry: QuotaLedgerEntry): string {
    return QUOTA_ENTRY_ACTION_LABELS[entry.entryType];
  }

  /** Units that came in read green, units that went out read red, and a hold or release (which nets out) stays neutral. */
  ledgerTone(entry: QuotaLedgerEntry): 'in' | 'out' | 'neutral' {
    if (entry.entryType === QuotaEntryType.RefundHold || entry.entryType === QuotaEntryType.RefundRelease) {
      return 'neutral';
    }
    return entry.unitsDelta >= 0 ? 'in' : 'out';
  }

  /** One tile per value the history can be narrowed to: what it adds up to over the whole history. */
  get ledgerTiles(): { key: PlatformFeature | 'Purchased' | 'Used' | ''; label: string; value: string; detail: string }[] {
    const s = this.summary;
    if (!s) {
      return [];
    }
    const type = (t: QuotaEntryType) => s.byEntryType.find((e) => e.entryType === t);
    const used = -((type(QuotaEntryType.Consumption)?.units ?? 0) + (type(QuotaEntryType.ConsumptionReversal)?.units ?? 0));
    const purchased = type(QuotaEntryType.Purchase);
    const entries = (n: number) => (n === 1 ? '1 entry' : n + ' entries');
    return [
      { key: '', label: 'All activity', value: String(s.totalEntries), detail: s.totalEntries === 1 ? 'movement' : 'movements' },
      { key: 'Purchased', label: 'Purchased', value: formatUnits(purchased?.units ?? 0), detail: entries(purchased?.count ?? 0) },
      { key: 'Used', label: 'Used', value: formatUnits(used), detail: entries(type(QuotaEntryType.Consumption)?.count ?? 0) },
      ...PLATFORM_FEATURES.map((f) => {
        const row = s.byFeature.find((x) => x.feature === f);
        return { key: f, label: this.featureLabels[f], value: formatUnits(row?.unitsUsed ?? 0), detail: entries(row?.count ?? 0) };
      }),
    ];
  }

  /** The daily series as SVG bars: credits bought (green) and used (red) per day, scaled to the busiest day. */
  get chartBars(): { x: number; y: number; w: number; h: number; kind: 'in' | 'out'; tip: string }[] {
    const days = this.chartDaily;
    const max = Math.max(1, ...days.flatMap((d) => [d.purchased, d.used]));
    const slot = this.chartWidth / Math.max(1, days.length);
    const w = Math.max(2, slot / 2 - 1);
    const bars: { x: number; y: number; w: number; h: number; kind: 'in' | 'out'; tip: string }[] = [];
    days.forEach((d, i) => {
      const add = (value: number, kind: 'in' | 'out', offset: number, label: string) => {
        if (value <= 0) {
          return;
        }
        const h = Math.max(1, (value / max) * (this.chartHeight - 4));
        bars.push({ x: i * slot + offset, y: this.chartHeight - h, w, h, kind, tip: d.date + ': ' + formatUnits(value) + ' ' + label });
      };
      add(d.purchased, 'in', 0, 'purchased');
      add(d.used, 'out', w + 1, 'used');
    });
    return bars;
  }

  get chartPeak(): number {
    return Math.max(0, ...this.chartDaily.flatMap((d) => [d.purchased, d.used]));
  }

  get chartHasData(): boolean {
    return this.chartPeak > 0;
  }

  /** The range the entries, tiles and graph are currently showing ("from|to"); the pickers only change it when Filter is pressed. */
  appliedRange = '|';

  /** True once the pickers hold something other than what is applied, so Filter has something to do. */
  get rangeChanged(): boolean {
    const { from, to } = this.range();
    return (from ?? '') + '|' + (to ?? '') !== this.appliedRange;
  }

  get hasRange(): boolean {
    return !!(this.fromControl.value || this.toControl.value);
  }

  /** What period the graph covers, in words. */
  get chartPeriod(): string {
    const [from, to] = this.appliedRange.split('|');
    if (!from && !to) {
      return 'Last 30 days';
    }
    return (from || 'the start') + ' to ' + (to || 'today');
  }

  onRangeChange(): void {
    const { from, to } = this.range();
    this.appliedRange = (from ?? '') + '|' + (to ?? '');
    this.ledgerPage = 1;
    this.loadLedger();
    this.loadSummary();
  }

  clearRange(): void {
    this.fromControl.setValue(null);
    this.toControl.setValue(null);
    this.appliedRange = '|';
    this.ledgerPage = 1;
    this.loadLedger();
    this.loadSummary();
  }

  private appliedFilter(): { from?: string; to?: string } {
    const [from, to] = this.appliedRange.split('|');
    return { from: from || undefined, to: to || undefined };
  }

  /** The chosen days as yyyy-MM-dd, read from the picked calendar dates (not shifted by the time zone). */
  private range(): { from?: string; to?: string } {
    const day = (d: Date | null) =>
      d ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : undefined;
    return { from: day(this.fromControl.value), to: day(this.toControl.value) };
  }

  onLedgerFilter(filter: PlatformFeature | 'Purchased' | 'Used' | ''): void {
    this.ledgerFilter = filter;
    this.ledgerPage = 1;
    this.loadLedger();
    this.loadChart();
  }

  /** What the movement was: its kind, the feature it was for when it has one, and the note. */
  ledgerActivity(entry: QuotaLedgerEntry): string {
    const parts: string[] = [];
    if (entry.feature) {
      parts.push(this.featureLabels[entry.feature]);
    }
    if (entry.note) {
      parts.push(entry.note);
    }
    return parts.length ? parts.join(' · ') : '—';
  }

  onLedgerPage(event: PageEvent): void {
    this.ledgerPage = event.pageIndex + 1;
    this.loadLedger();
  }

  /** What the graph is showing, in words: "All activity", "Purchased", "Lead discovery"... */
  get chartTitle(): string {
    if (this.ledgerFilter === '') {
      return 'All activity';
    }
    return this.ledgerFilter === 'Purchased' || this.ledgerFilter === 'Used' ? this.ledgerFilter : this.featureLabels[this.ledgerFilter];
  }

  private loadChart(): void {
    const filter = this.ledgerFilter;
    this.loadingChart = true;
    this.refundService
      .getTenantLedgerSummary(this.tenantId, 30, {
        feature: filter && filter !== 'Purchased' && filter !== 'Used' ? filter : undefined,
        entryType: filter === 'Purchased' ? QuotaEntryType.Purchase : filter === 'Used' ? QuotaEntryType.Consumption : undefined,
        ...this.appliedFilter(),
      })
      .pipe(finalize(() => (this.loadingChart = false)))
      .subscribe({ next: (result) => (this.chartDaily = result.daily) });
  }

  private loadSummary(): void {
    this.loadingSummary = true;
    this.refundService
      .getTenantLedgerSummary(this.tenantId, 30, this.appliedFilter())
      .pipe(finalize(() => (this.loadingSummary = false)))
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          this.chartDaily = this.ledgerFilter ? this.chartDaily : summary.daily;
          if (this.ledgerFilter) {
            this.loadChart();
          }
        },
      });
  }

  private loadLedger(): void {
    this.loadingLedger = true;
    this.refundService
      .getTenantLedger(this.tenantId, { page: this.ledgerPage, pageSize: this.ledgerPageSize, feature: this.ledgerFilter && this.ledgerFilter !== 'Purchased' && this.ledgerFilter !== 'Used' ? this.ledgerFilter : undefined,
        entryType:
          this.ledgerFilter === 'Purchased' ? QuotaEntryType.Purchase : this.ledgerFilter === 'Used' ? QuotaEntryType.Consumption : undefined,
        ...this.appliedFilter(),
      })
      .pipe(finalize(() => (this.loadingLedger = false)))
      .subscribe({
        next: (result) => {
          this.ledger = result.items;
          this.ledgerTotal = result.totalCount;
        },
      });
  }

  private loadQuota(): void {
    this.loadingQuota = true;
    this.ledgerPage = 1;
    this.loadLedger();
    this.loadSummary();
    this.refundService
      .getTenantQuota(this.tenantId)
      .pipe(finalize(() => (this.loadingQuota = false)))
      .subscribe({ next: (quota) => (this.quota = quota) });
  }

  private loadPayments(): void {
    this.loadingPayments = true;
    this.refundService
      .getTenantPayments(this.tenantId)
      .pipe(finalize(() => (this.loadingPayments = false)))
      .subscribe({ next: (payments) => (this.payments = payments) });
  }

  private loadConfig(): void {
    this.loadingConfig = true;
    this.config.getWhatsAppConfig(this.tenantId).subscribe({
      next: (config) => {
        this.whatsAppConfig = config;
        this.loadingConfig = false;
      },
      error: () => (this.loadingConfig = false),
    });
  }

  private loadConfigOverrides(): void {
    this.loadingConfigOverrides = true;
    this.config
      .getConfigOverrides(this.tenantId)
      .pipe(finalize(() => (this.loadingConfigOverrides = false)))
      .subscribe({
        next: (categories) => (this.configOverrides = categories),
      });
  }

  private confirmAndRun(
    data: ConfirmDialogData,
    action: () => Observable<void>,
    successMessage: string,
    onSuccess?: () => void
  ): void {
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        action().subscribe(() => {
          this.notify.success(successMessage);
          onSuccess?.();
          this.load();
        });
      });
  }
}
