import { Component, Inject, OnInit, Optional, ViewChild } from '@angular/core';
import { MatButtonToggleGroup } from '@angular/material/button-toggle';
import { finalize } from 'rxjs/operators';

import { formatCharge } from '../../../core/models/billing.model';
import {
  DEFAULT_WHATSAPP_CONNECTION_MODE,
  TenantCharges,
  TenantMessageUsage,
  TenantWhatsAppConfig,
  UpdateTenantWhatsAppConfigRequest,
  WhatsAppConnectionMode,
} from '../../../core/models/tenant-settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';
import { EMBEDDED_IN_ONBOARDING } from '../../../core/tokens/embedded-in-onboarding';

/**
 * A tenant's own settings. The tenant's whole WhatsApp job is one button: "Connect with Meta". They type no number - Meta's own
 * window asks for it, and the number Meta confirms is saved on the tenant by the API. The WhatsApp Business connection is owned
 * jointly with the Platform Admin: the tenant's Admin can use "Connect with Meta" here (this page is also the onboarding wizard's
 * WhatsApp step), or fall back to entering the details by hand, and the Platform Admin Console edits the same connection.
 * Message usage (this month's send count vs. the plan's quota) is a read-only derived figure - TenantSettingsService.getUsage, backed
 * by the same count IPlanLimitsService.EnsureCanSendMessageAsync already enforces sends against.
 *
 * AI provider status is deliberately not shown here (by request) - which model/provider is in use
 * behind the scenes is not something a tenant needs or should see; this component never even calls
 * TenantSettingsService.getAiConfig(), so that detail never reaches the tenant's browser at all.
 *
 * Timezone and Country used to be edited here; they moved to the Business Profile page
 * (BusinessProfileComponent) alongside the tenant's other business details, and this page only links
 * there.
 */
@Component({
  selector: 'app-tenant-settings-list',
  templateUrl: './tenant-settings-list.component.html',
  styleUrls: ['./tenant-settings-list.component.scss'],
})
export class TenantSettingsListComponent implements OnInit {
  loadingWhatsApp = true;
  loadingUsage = true;
  loadingCharges = true;

  whatsAppConfig: TenantWhatsAppConfig | null = null;
  usage: TenantMessageUsage | null = null;
  charges: TenantCharges | null = null;

  readonly formatCharge = formatCharge;

  /** 0–100, clamped so a tenant that's gone over quota still shows a full (not overflowing) bar.
   * Null when unlimited (no plan yet) — nothing to show a fraction of. */
  get usagePercent(): number | null {
    if (!this.usage?.maxMessagesPerMonth) {
      return null;
    }
    return Math.min(100, Math.round((this.usage.messagesSentThisMonth / this.usage.maxMessagesPerMonth) * 100));
  }

  readonly saveWhatsApp = (request: UpdateTenantWhatsAppConfigRequest) => this.tenantSettings.saveWhatsAppConfig(request);
  readonly verifyWhatsApp = () => this.tenantSettings.verifyWhatsAppConfig();

  /** Inside onboarding's "WhatsApp" step only "Connect with Meta" is shown: the manual connection form, usage and charges are left out. */
  readonly embedded: boolean;

  /** The one way the tenant connects: Connect with Meta, or details typed in. Exactly one at a time - the toggle group is single-select. */
  mode: WhatsAppConnectionMode = DEFAULT_WHATSAPP_CONNECTION_MODE;
  savingMode = false;
  @ViewChild('modeGroup') private modeGroup?: MatButtonToggleGroup;

  constructor(
    private readonly tenantSettings: TenantSettingsService,
    private readonly notify: NotificationService,
    @Optional() @Inject(EMBEDDED_IN_ONBOARDING) embedded: boolean | null
  ) {
    this.embedded = !!embedded;
  }

  /**
   * The tenant picked a mode. With a saved connection it is recorded on it first and only shown as chosen once the API confirms;
   * a failure puts the toggle back and says so. With nothing connected yet there is no record to hold it, so it only decides which
   * side is shown, and is saved together with the connection (the manual form sends it; Connect with Meta records Automatic).
   */
  selectMode(next: WhatsAppConnectionMode): void {
    if (next === this.mode || this.savingMode) {
      return;
    }
    if (!this.whatsAppConfig) {
      this.mode = next;
      return;
    }
    this.savingMode = true;
    this.tenantSettings
      .setWhatsAppConnectionMode(next)
      .pipe(finalize(() => (this.savingMode = false)))
      .subscribe({
        next: (config) => {
          this.whatsAppConfig = config;
          this.mode = config.connectionMode ?? next;
          this.notify.success(this.mode === 'Automatic' ? 'Connection mode: Automatic.' : 'Connection mode: Manual.');
        },
        error: () => {
          // Not saved: show the mode that is. (The error interceptor says why.)
          if (this.modeGroup) {
            this.modeGroup.value = this.mode;
          }
        },
      });
  }

  ngOnInit(): void {
    // Both here and inside onboarding's WhatsApp step: "Connect with Meta" needs to know what is already connected.
    this.tenantSettings.getWhatsAppConfig().subscribe({
      next: (config) => {
        this.whatsAppConfig = config;
        this.mode = config?.connectionMode ?? DEFAULT_WHATSAPP_CONNECTION_MODE;
        this.loadingWhatsApp = false;
      },
      error: () => (this.loadingWhatsApp = false),
    });

    if (this.embedded) {
      return; // the rest of the page is not part of this step
    }

    this.tenantSettings.getUsage().subscribe({
      next: (usage) => {
        this.usage = usage;
        this.loadingUsage = false;
      },
      error: () => (this.loadingUsage = false),
    });

    this.tenantSettings.getCharges().subscribe({
      next: (charges) => {
        this.charges = charges;
        this.loadingCharges = false;
      },
      error: () => (this.loadingCharges = false),
    });
  }
}
