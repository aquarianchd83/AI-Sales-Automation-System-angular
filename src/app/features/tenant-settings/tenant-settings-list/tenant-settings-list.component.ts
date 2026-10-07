import { Component, Inject, OnInit, Optional } from '@angular/core';
import { AbstractControl, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { formatCharge } from '../../../core/models/billing.model';
import {
  TenantCharges,
  TenantMessageUsage,
  TenantWhatsAppConfig,
  UpdateTenantWhatsAppConfigRequest,
} from '../../../core/models/tenant-settings.model';
import { PHONE_PATTERN } from '../../../core/models/tenant-profile.model';
import { NotificationService } from '../../../core/services/notification.service';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';
import { EMBEDDED_IN_ONBOARDING } from '../../../core/tokens/embedded-in-onboarding';

/** A phone number, judged on what would be saved (trimmed): digits, spaces, brackets, dashes and an optional leading +,
 * with digits enough to be one. The API applies the same rule. Blank is fine - it clears the number. */
function phoneNumber(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value?.trim();
  if (!value) {
    return null;
  }
  if (!PHONE_PATTERN.test(value)) {
    return { pattern: true };
  }
  return value.replace(/\D/g, '').length < 7 ? { tooShort: true } : null;
}

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

  /** Inside onboarding's "WhatsApp" step only the number is asked for: connecting it to WhatsApp (credentials,
   * verification) comes later, so the connection form, usage and charges are left out. */
  readonly embedded: boolean;

  /** The number customers will message - the one thing onboarding needs here. */
  readonly whatsAppNumber = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(32), phoneNumber],
  });
  loadingNumber = true;
  savingNumber = false;
  private savedNumber = '';

  constructor(
    private readonly tenantSettings: TenantSettingsService,
    private readonly notify: NotificationService,
    @Optional() @Inject(EMBEDDED_IN_ONBOARDING) embedded: boolean | null
  ) {
    this.embedded = !!embedded;
  }

  get numberChanged(): boolean {
    return this.whatsAppNumber.value.trim() !== this.savedNumber;
  }

  saveNumber(): void {
    if (this.savingNumber || this.whatsAppNumber.invalid || !this.numberChanged) {
      this.whatsAppNumber.markAsTouched();
      return;
    }
    this.savingNumber = true;
    this.tenantSettings
      .saveWhatsAppNumber(this.whatsAppNumber.value.trim() || null)
      .pipe(finalize(() => (this.savingNumber = false)))
      .subscribe({
        next: (saved) => {
          this.savedNumber = saved.whatsAppNumber ?? '';
          this.whatsAppNumber.setValue(this.savedNumber);
          this.notify.success(this.savedNumber ? 'WhatsApp number saved.' : 'WhatsApp number cleared.');
        },
        error: () => undefined, // the error interceptor shows why
      });
  }

  ngOnInit(): void {
    this.tenantSettings.getWhatsAppNumber().subscribe({
      next: (result) => {
        this.savedNumber = result.whatsAppNumber ?? '';
        this.whatsAppNumber.setValue(this.savedNumber);
        this.loadingNumber = false;
      },
      error: () => (this.loadingNumber = false),
    });

    if (this.embedded) {
      return; // the rest of the page is not part of this step
    }

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
