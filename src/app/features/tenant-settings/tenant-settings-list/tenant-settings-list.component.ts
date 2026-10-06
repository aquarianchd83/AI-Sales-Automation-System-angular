import { Component, OnInit } from '@angular/core';

import { formatCharge } from '../../../core/models/billing.model';
import {
  TenantCharges,
  TenantMessageUsage,
  TenantWhatsAppConfig,
  UpdateTenantWhatsAppConfigRequest,
} from '../../../core/models/tenant-settings.model';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';

/**
 * A tenant's own settings. The WhatsApp Business connection is owned jointly with the Platform Admin: the tenant's
 * Admin can save and verify it here (this page is also the onboarding wizard's WhatsApp step), and the Platform
 * Admin Console edits the same connection. Message usage (this month's send count vs. the plan's quota) is a
 * read-only derived figure — TenantSettingsService.getUsage, backed by the same count
 * IPlanLimitsService.EnsureCanSendMessageAsync already enforces sends against.
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

  constructor(private readonly tenantSettings: TenantSettingsService) {}

  ngOnInit(): void {
    this.tenantSettings.getWhatsAppConfig().subscribe({
      next: (config) => {
        this.whatsAppConfig = config;
        this.loadingWhatsApp = false;
      },
      error: () => (this.loadingWhatsApp = false),
    });

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
