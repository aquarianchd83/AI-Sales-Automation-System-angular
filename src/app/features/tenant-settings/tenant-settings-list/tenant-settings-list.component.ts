import { Component, OnInit } from '@angular/core';

import { TenantAiProviderConfig, TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';

/**
 * A tenant's own read-only view of its WhatsApp Business Account connection and AI provider setup
 * (SaaS conversion Phase B) — status only. A PlatformSuperAdmin now owns creating, editing and
 * deleting both (see the backend's PlatformTenantConfigController doc comment for why): they hold
 * real, security-sensitive credentials whose correctness affects billing and platform-wide abuse
 * exposure, not just this one tenant.
 */
@Component({
  selector: 'app-tenant-settings-list',
  templateUrl: './tenant-settings-list.component.html',
  styleUrls: ['./tenant-settings-list.component.scss'],
})
export class TenantSettingsListComponent implements OnInit {
  loadingWhatsApp = true;
  loadingAi = true;

  whatsAppConfig: TenantWhatsAppConfig | null = null;
  aiConfig: TenantAiProviderConfig | null = null;

  constructor(private readonly tenantSettings: TenantSettingsService) {}

  ngOnInit(): void {
    this.tenantSettings.getWhatsAppConfig().subscribe({
      next: (config) => {
        this.whatsAppConfig = config;
        this.loadingWhatsApp = false;
      },
      error: () => (this.loadingWhatsApp = false),
    });

    this.tenantSettings.getAiConfig().subscribe({
      next: (config) => {
        this.aiConfig = config;
        this.loadingAi = false;
      },
      error: () => (this.loadingAi = false),
    });
  }
}
