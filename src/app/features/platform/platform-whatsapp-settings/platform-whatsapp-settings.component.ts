import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { DeliveryTestResult } from '../../../core/models/platform.model';
import { PlatformWhatsAppSettings, UpdatePlatformWhatsAppSettingsRequest } from '../../../core/models/platform-whatsapp.model';
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

  save(): void {
    if (this.saving || this.form.pristine) {
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
    if (!this.form.pristine) {
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
