import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { DeliveryTestResult } from '../../../core/models/platform.model';
import { PlatformWhatsAppSettings, UpdatePlatformWhatsAppSettingsRequest } from '../../../core/models/platform-whatsapp.model';
import { SettingCategory, SettingItem } from '../../../core/models/settings.model';
import { SettingsService } from '../../../core/services/settings.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppSettingsService } from '../../../core/services/platform-whatsapp-settings.service';

/**
 * The Platform Admin Console's WhatsApp page: the number the PLATFORM sends tenant notices from (plan expiring, credits running out) -
 * never a tenant's own. Saved to the database only, the access token encrypted at rest and never shown again: a blank token field keeps the
 * stored one and "Remove" clears it. The test sends Meta's own sample message from the SAVED number, so save first.
 */
@Component({
  selector: 'app-platform-whatsapp-settings',
  templateUrl: './platform-whatsapp-settings.component.html',
  styleUrls: ['./platform-whatsapp-settings.component.scss'],
})
export class PlatformWhatsAppSettingsComponent implements OnInit {
  readonly form = this.fb.group({
    enabled: true,
    phoneNumberId: ['', [Validators.pattern(/^\d{5,30}$/)]],
    whatsAppBusinessAccountId: ['', [Validators.pattern(/^\d{5,30}$/)]],
    accessToken: '',
    removeAccessToken: false,
    apiVersion: ['v19.0', [Validators.required, Validators.pattern(/^v\d{1,2}\.\d{1,2}$/)]],
    apiBaseUrl: ['', [Validators.pattern(/^https:\/\/\S+$/i)]],
  });

  /** The shared Meta app and webhook keys (the WhatsApp category of the System settings): which provider the platform runs, the app that receives
   * every tenant's webhooks, and the simulator's failure rate. Saved on their own - a secret left blank keeps what is stored. */
  readonly appForm = this.fb.group({
    provider: '',
    simulatedFailureRatePercent: '',
    appId: '',
    appSecret: '',
    webhookVerifyToken: '',
  });
  readonly appKeys: Record<string, string> = {
    provider: 'WhatsApp:Provider',
    simulatedFailureRatePercent: 'WhatsApp:SimulatedFailureRatePercent',
    appId: 'WhatsApp:AppId',
    appSecret: 'WhatsApp:AppSecret',
    webhookVerifyToken: 'WhatsApp:WebhookVerifyToken',
  };
  appItems: Record<string, SettingItem> = {};
  savingApp = false;

  /** Where the test goes. Not part of the settings, so outside the form (and its "unsaved changes" state). */
  readonly testTo = this.fb.control('', [Validators.pattern(/^\s*\+[0-9 ()-]{8,20}\s*$/)]);

  current: PlatformWhatsAppSettings | null = null;
  loading = true;
  loadFailed = false;
  saving = false;
  testing = false;
  /** The outcome of the last test; cleared as soon as the form changes, since it no longer describes what is on screen. */
  testResult: DeliveryTestResult | null = null;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly settings: PlatformWhatsAppSettingsService,
    private readonly systemSettings: SettingsService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.form.valueChanges.subscribe(() => (this.testResult = null));
  }

  /** The last four characters of the stored token, never the value. */
  get storedTokenHint(): string | null {
    return this.current?.hasAccessToken ? this.current.accessTokenHint ?? 'set' : null;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.settings
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (settings) => this.apply(settings),
        error: () => (this.loadFailed = true),
      });
  }

  /** A secret never arrives with a value; show only whether one is stored. */
  appHint(control: string): string | null {
    const item = this.appItems[control];
    return item?.isSecret ? (item.hasValue ? item.valueHint || 'Currently set - leave blank to keep' : 'Not set') : null;
  }

  discard(): void {
    this.load();
    this.loadApp();
  }

  loadApp(): void {
    this.systemSettings.getCategory('WhatsApp').subscribe({ next: (category) => this.applyApp(category) });
  }

  private saveApp(): void {
    if (this.savingApp || this.appForm.pristine) {
      return;
    }
    const values: Record<string, string | null> = {};
    for (const [control, key] of Object.entries(this.appKeys)) {
      const c = this.appForm.get(control)!;
      if (c.dirty && !(this.appItems[control]?.isSecret && !c.value)) {
        values[key] = String(c.value).trim();
      }
    }
    if (!Object.keys(values).length) {
      this.notify.info('No changes to save.');
      return;
    }
    this.savingApp = true;
    this.systemSettings
      .update('WhatsApp', values)
      .pipe(finalize(() => (this.savingApp = false)))
      .subscribe({
        next: () => {
          this.notify.success('WhatsApp app settings saved.');
          this.loadApp();
        },
      });
  }

  private applyApp(category: SettingCategory): void {
    const reset: Record<string, string> = {};
    this.appItems = {};
    for (const [control, key] of Object.entries(this.appKeys)) {
      const item = category.items.find((i) => i.key === key);
      if (item) {
        this.appItems[control] = item;
      }
      reset[control] = item && !item.isSecret ? item.value ?? '' : '';
    }
    this.appForm.reset(reset);
  }

  /** Nothing to save on either part of the page. */
  get pristine(): boolean {
    return this.form.pristine && this.appForm.pristine;
  }

  /** One Save for the whole page: the number and its settings, then the shared Meta app keys. */
  save(): void {
    if (this.saving || this.savingApp || this.pristine) {
      return;
    }
    if (this.form.pristine) {
      this.saveApp();
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const request = this.buildRequest();
    const hasToken = request.accessToken === null ? !!this.current?.hasAccessToken : request.accessToken !== '';
    if (request.enabled && (!request.phoneNumberId || !hasToken)) {
      this.notify.error('Enter the phone number id and the access token before turning the platform WhatsApp number on.');
      return;
    }

    this.saving = true;
    this.settings
      .save(request)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (settings) => {
          this.notify.success('Platform WhatsApp saved. It applies from the next request - no restart needed.');
          this.apply(settings);
          if (!this.appForm.pristine) {
            this.saveApp();
          }
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Sends Meta's sample message from the saved number to prove the credentials work end to end. */
  sendTest(): void {
    const to = this.testTo.value.trim();
    if (this.testing || !to || this.testTo.invalid) {
      this.testTo.markAsTouched();
      return;
    }
    if (!this.pristine) {
      this.notify.error('Save the settings first - the test uses the saved number.');
      return;
    }

    this.testing = true;
    this.testResult = null;
    this.settings
      .test(to)
      .pipe(finalize(() => (this.testing = false)))
      .subscribe({
        next: (result) => (this.testResult = result),
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Token: blank = null = keep what is stored; "Remove" = '' = clear it. */
  private buildRequest(): UpdatePlatformWhatsAppSettingsRequest {
    const raw = this.form.getRawValue();
    return {
      enabled: raw.enabled,
      phoneNumberId: raw.phoneNumberId.trim(),
      whatsAppBusinessAccountId: raw.whatsAppBusinessAccountId.trim(),
      accessToken: raw.removeAccessToken ? '' : raw.accessToken.trim() || null,
      apiVersion: raw.apiVersion.trim(),
      apiBaseUrl: raw.apiBaseUrl.trim(),
    };
  }

  private apply(settings: PlatformWhatsAppSettings): void {
    this.current = settings;
    this.form.reset({
      enabled: settings.enabled,
      phoneNumberId: settings.phoneNumberId,
      whatsAppBusinessAccountId: settings.whatsAppBusinessAccountId,
      accessToken: '',
      removeAccessToken: false,
      apiVersion: settings.apiVersion,
      apiBaseUrl: settings.apiBaseUrl,
    });
  }
}
