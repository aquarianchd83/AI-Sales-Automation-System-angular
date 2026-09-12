import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { RegionOption, TimeZoneOption } from '../../../core/models/billing.model';
import { TenantWhatsAppConfig } from '../../../core/models/tenant-settings.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantProfileService } from '../../../core/services/tenant-profile.service';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';
import { TimeZoneService } from '../../../core/services/timezone.service';

/**
 * A tenant's own read-only view of its WhatsApp Business Account connection (SaaS conversion
 * Phase B) — status only. A PlatformSuperAdmin now owns creating, editing and deleting it (see the
 * backend's PlatformTenantConfigController doc comment for why): it holds a real, security-
 * sensitive credential whose correctness affects billing and platform-wide abuse exposure, not just
 * this one tenant.
 *
 * AI provider status is deliberately not shown here (by request) - which model/provider is in use
 * behind the scenes is not something a tenant needs or should see; this component never even calls
 * TenantSettingsService.getAiConfig(), so that detail never reaches the tenant's browser at all.
 *
 * The Workspace card below is the exception - Timezone and Country are tenant-owned business facts,
 * not security-sensitive credentials, so the tenant's own Admin edits them directly here (a
 * PlatformSuperAdmin can also override either from the Platform Admin Console for support scenarios -
 * see PlatformTenantDetailComponent). Country is what actually drives plan pricing currency (see
 * RegionalPricingCatalog.Resolve on the backend) - independent of Timezone, since a single Timezone
 * can't identify a country and vice versa (a multi-timezone country like the US or Australia).
 */
@Component({
  selector: 'app-tenant-settings-list',
  templateUrl: './tenant-settings-list.component.html',
  styleUrls: ['./tenant-settings-list.component.scss'],
})
export class TenantSettingsListComponent implements OnInit {
  readonly timezoneControl = new FormControl<string | null>(null);
  readonly countryControl = new FormControl<string | null>(null);

  loadingWhatsApp = true;
  loadingProfile = true;
  savingTimezone = false;
  savingCountry = false;

  whatsAppConfig: TenantWhatsAppConfig | null = null;
  timezones: TimeZoneOption[] = [];
  regions: RegionOption[] = [];

  constructor(
    private readonly tenantSettings: TenantSettingsService,
    private readonly tenantProfile: TenantProfileService,
    private readonly timeZoneService: TimeZoneService,
    private readonly billing: BillingService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.tenantSettings.getWhatsAppConfig().subscribe({
      next: (config) => {
        this.whatsAppConfig = config;
        this.loadingWhatsApp = false;
      },
      error: () => (this.loadingWhatsApp = false),
    });

    this.timeZoneService.getTimezones().subscribe({
      next: (timezones) => (this.timezones = timezones),
      error: () => (this.timezones = []),
    });

    this.billing.getRegions().subscribe({
      next: (regions) => (this.regions = regions),
      error: () => (this.regions = []),
    });

    this.loadProfile();
  }

  saveTimezone(): void {
    const timezone = this.timezoneControl.value;
    if (!timezone || this.savingTimezone) {
      return;
    }

    this.savingTimezone = true;
    this.tenantProfile
      .updateTimezone(timezone)
      .pipe(finalize(() => (this.savingTimezone = false)))
      .subscribe({
        next: () => {
          this.notify.success('Timezone updated.');
          this.timezoneControl.markAsPristine();
        },
      });
  }

  saveCountry(): void {
    const countryCode = this.countryControl.value;
    if (!countryCode || this.savingCountry) {
      return;
    }

    this.savingCountry = true;
    this.tenantProfile
      .updateCountry(countryCode)
      .pipe(finalize(() => (this.savingCountry = false)))
      .subscribe({
        next: () => {
          this.notify.success('Country updated — plan pricing now shows in the matching currency.');
          this.countryControl.markAsPristine();
        },
      });
  }

  private loadProfile(): void {
    this.loadingProfile = true;
    this.tenantProfile.getProfile().subscribe({
      next: (profile) => {
        this.timezoneControl.setValue(profile.timezone);
        this.countryControl.setValue(profile.countryCode);
        this.loadingProfile = false;
      },
      error: () => (this.loadingProfile = false),
    });
  }
}
