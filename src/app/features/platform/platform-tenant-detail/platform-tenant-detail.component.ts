import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
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
import { TenantAiProviderConfig, TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { ImpersonationSessionService } from '../../../core/services/impersonation-session.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformTenantAiConfigDialogComponent } from '../platform-tenant-ai-config-dialog/platform-tenant-ai-config-dialog.component';
import { PlatformTenantWhatsAppConfigDialogComponent } from '../platform-tenant-whatsapp-config-dialog/platform-tenant-whatsapp-config-dialog.component';

@Component({
  selector: 'app-platform-tenant-detail',
  templateUrl: './platform-tenant-detail.component.html',
  styleUrls: ['./platform-tenant-detail.component.scss'],
})
export class PlatformTenantDetailComponent implements OnInit {
  readonly statusLabels = TENANT_STATUS_LABELS;
  readonly subscriptionStatusLabels = SUBSCRIPTION_STATUS_LABELS;
  readonly TenantStatus = TenantStatus;
  readonly planControl = new FormControl<string | null>(null);

  tenant: PlatformTenantDetail | null = null;
  plans: PlatformPlan[] = [];
  loading = true;
  impersonating = false;
  savingPlan = false;

  whatsAppConfig: TenantWhatsAppConfig | null = null;
  aiConfig: TenantAiProviderConfig | null = null;
  loadingConfig = true;

  private tenantId!: string;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly tenants: PlatformTenantService,
    private readonly billing: PlatformBillingService,
    private readonly config: PlatformTenantConfigService,
    private readonly impersonation: ImpersonationSessionService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.paramMap.get('id') ?? '';
    this.billing.getPlans().subscribe({ next: (plans) => (this.plans = plans) });
    this.load();
    this.loadConfig();
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

  private load(): void {
    this.loading = true;
    this.tenants.getById(this.tenantId).subscribe({
      next: (tenant) => {
        this.tenant = tenant;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        void this.router.navigate(['/platform/tenants']);
      },
    });
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
