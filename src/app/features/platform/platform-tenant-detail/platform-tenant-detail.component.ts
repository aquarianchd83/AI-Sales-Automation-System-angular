import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  PlatformPlan,
  PlatformTenantDetail,
  PlatformTenantJobs,
  SUBSCRIPTION_STATUS_LABELS,
  TENANT_JOB_RUN_OUTCOME_LABELS,
  TENANT_STATUS_LABELS,
  TenantJobRunOutcome,
  TenantStatus,
} from '../../../core/models/platform.model';
import {
  Payment,
  QUOTA_TYPE_LABELS,
  QUOTA_GRANT_ORIGIN_LABELS,
  QuotaBalance,
  RegionOption,
  TimeZoneOption,
  formatCharge,
  formatUnits,
} from '../../../core/models/billing.model';
import { TenantAiProviderConfig, TenantSettingCategory, TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { BillingService } from '../../../core/services/billing.service';
import { ImpersonationSessionService } from '../../../core/services/impersonation-session.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { PlatformJobService } from '../../../core/services/platform-job.service';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';
import { PlatformRefundService } from '../../../core/services/platform-refund.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformQuotaAdjustDialogComponent } from '../platform-quota-adjust-dialog/platform-quota-adjust-dialog.component';
import { PlatformRefundReviewDialogComponent } from '../platform-refund-review-dialog/platform-refund-review-dialog.component';
import { PlatformTenantAiConfigDialogComponent } from '../platform-tenant-ai-config-dialog/platform-tenant-ai-config-dialog.component';
import { PlatformTenantConfigOverridesDialogComponent } from '../platform-tenant-config-overrides-dialog/platform-tenant-config-overrides-dialog.component';
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
  aiConfig: TenantAiProviderConfig | null = null;
  loadingConfig = true;

  configOverrides: TenantSettingCategory[] = [];
  loadingConfigOverrides = true;

  /** Read-only summary of this tenant's background jobs. Scheduling, pausing and running them lives
   * on the Background Jobs screen (deep-linked below with this tenant pre-selected) rather than being
   * duplicated here - one place owns those actions and their audit entries. */
  tenantJobs: PlatformTenantJobs | null = null;
  loadingJobs = true;

  readonly quotaLabels = QUOTA_TYPE_LABELS;
  readonly originLabels = QUOTA_GRANT_ORIGIN_LABELS;
  readonly formatUnits = formatUnits;

  /** This tenant's prepaid quota and payments - loaded beside the profile rather than with it, so a slow
   * quota query never holds up the rest of the page. */
  quota: QuotaBalance[] = [];
  loadingQuota = true;
  payments: Payment[] = [];
  loadingPayments = true;
  togglingRefunds = false;

  private tenantId!: string;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tenants: PlatformTenantService,
    private readonly billing: PlatformBillingService,
    private readonly jobService: PlatformJobService,
    private readonly config: PlatformTenantConfigService,
    private readonly timeZoneService: TimeZoneService,
    private readonly billingService: BillingService,
    private readonly impersonation: ImpersonationSessionService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly refundService: PlatformRefundService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('id') ?? '';
    this.billing.getPlans().subscribe({ next: (plans) => (this.plans = plans) });
    this.timeZoneService.getTimezones().subscribe({ next: (timezones) => (this.timezones = timezones) });
    this.load();
    this.loadConfig();
    this.loadJobs();
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
    const amount = Math.abs(payment.localAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${payment.localAmount < 0 ? '−' : ''}${payment.currencySymbol}${amount}`;
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
        title: 'Delete this tenant?',
        message: `${this.tenant?.name} will be locked out permanently. This never deletes their underlying data — it's a terminal status you can still reverse.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => this.tenants.delete(this.tenantId),
      'Tenant deleted.'
    );
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
      .updateCountry(this.tenantId, countryCode)
      .pipe(finalize(() => (this.savingCountry = false)))
      .subscribe(() => {
        this.notify.success('Country updated — plan pricing now shows in the matching currency.');
        this.load();
      });
  }

  editWhatsAppConfig(): void {
    this.dialog
      .open(PlatformTenantWhatsAppConfigDialogComponent, {
        data: { tenantId: this.tenantId, tenantName: this.tenant?.name ?? '', config: this.whatsAppConfig },
        width: '560px',
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

  editAiConfig(): void {
    this.dialog
      .open(PlatformTenantAiConfigDialogComponent, {
        data: { tenantId: this.tenantId, tenantName: this.tenant?.name ?? '', config: this.aiConfig },
        width: '560px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadConfig();
        }
      });
  }

  deleteAiConfig(): void {
    this.confirmAndRun(
      {
        title: 'Delete AI provider configuration?',
        message: `${this.tenant?.name} will fall back to the built-in Simulated provider until it's reconfigured.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => this.config.deleteAiConfig(this.tenantId),
      'AI provider configuration deleted.',
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

  private loadQuota(): void {
    this.loadingQuota = true;
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
      next: (config) => (this.whatsAppConfig = config),
    });
    this.config.getAiConfig(this.tenantId).subscribe({
      next: (config) => {
        this.aiConfig = config;
        this.loadingConfig = false;
      },
      error: () => (this.loadingConfig = false),
    });
  }

  /** See PlatformJobsComponent.outcomeLabel - same nullable-index reason. */
  outcomeLabel(outcome: TenantJobRunOutcome | null): string {
    return outcome == null ? '' : TENANT_JOB_RUN_OUTCOME_LABELS[outcome];
  }

  private loadJobs(): void {
    this.loadingJobs = true;
    this.jobService
      .getForTenant(this.tenantId)
      .pipe(finalize(() => (this.loadingJobs = false)))
      .subscribe({
        next: (jobs) => (this.tenantJobs = jobs),
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
