import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import {
  DeliveryTestResult,
  PlatformDeliverySettings,
  UpdatePlatformDeliverySettingsRequest,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformDeliverySettingsService } from '../../../core/services/platform-delivery-settings.service';

/**
 * The Platform Admin Console's Authentication Delivery page: how the platform reaches people for sign-in - the web app's address (for the
 * links in emails), the SMTP server, and the MSG91 SMS account. Saved to the database only, the SMTP password and the SMS auth key
 * encrypted at rest and never shown again: a blank secret field keeps the stored one, and "Remove" clears it. The Send test buttons send
 * one real message with what is on screen, saved or not.
 */
@Component({
  selector: 'app-platform-delivery-settings',
  templateUrl: './platform-delivery-settings.component.html',
  styleUrls: ['./platform-delivery-settings.component.scss'],
})
export class PlatformDeliverySettingsComponent implements OnInit {
  readonly form = this.fb.group({
    publicUrl: ['', [Validators.pattern(/^https?:\/\/\S+$/i)]],
    smtpHost: '',
    smtpPort: [587, [Validators.required, Validators.min(1), Validators.max(65535)]],
    smtpUser: '',
    smtpFrom: ['', [Validators.email]],
    smtpEnableSsl: true,
    smtpPassword: '',
    removeSmtpPassword: false,
    smsEnabled: false,
    smsOtpTemplateId: '',
    smsBaseUrl: ['', [Validators.pattern(/^https:\/\/\S+$/i)]],
    smsAuthKey: '',
    removeSmsAuthKey: false,
  });

  /** Where the test messages go. Not part of the settings, so outside the form (and its "unsaved changes" state). */
  readonly testEmailTo = this.fb.control('', [Validators.email]);
  readonly testSmsTo = this.fb.control('', [Validators.pattern(/^\+[0-9 ()-]{8,20}$/)]);

  current: PlatformDeliverySettings | null = null;
  loading = true;
  loadFailed = false;
  saving = false;
  testingEmail = false;
  testingSms = false;
  /** Outcomes of the last tests; cleared as soon as the form changes, since they no longer describe what is on screen. */
  emailResult: DeliveryTestResult | null = null;
  smsResult: DeliveryTestResult | null = null;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly delivery: PlatformDeliverySettingsService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.form.valueChanges.subscribe(() => {
      this.emailResult = null;
      this.smsResult = null;
    });
  }

  /** The last four characters of a stored secret, never the value. */
  storedHint(kind: 'smtpPassword' | 'smsAuthKey'): string | null {
    if (!this.current) {
      return null;
    }
    const has = kind === 'smtpPassword' ? this.current.hasSmtpPassword : this.current.hasSmsAuthKey;
    const hint = kind === 'smtpPassword' ? this.current.smtpPasswordHint : this.current.smsAuthKeyHint;
    return has ? hint ?? 'set' : null;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.delivery
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

    this.saving = true;
    this.delivery
      .save(this.buildRequest())
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (settings) => {
          this.notify.success('Delivery settings saved. They apply from the next request - no restart needed.');
          this.apply(settings);
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Sends one real email with what is on screen. A blank password field tests with the stored password. */
  sendTestEmail(): void {
    const to = this.testEmailTo.value.trim();
    if (this.testingEmail || !to || this.testEmailTo.invalid) {
      this.testEmailTo.markAsTouched();
      return;
    }
    if (!this.form.controls.smtpHost.value.trim() || !this.form.controls.smtpFrom.value.trim()) {
      this.notify.error('Enter an SMTP host and a From address to test.');
      return;
    }

    this.testingEmail = true;
    this.emailResult = null;
    this.delivery
      .testEmail({ settings: this.buildRequest(), to })
      .pipe(finalize(() => (this.testingEmail = false)))
      .subscribe({
        next: (result) => (this.emailResult = result),
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Sends one real text (with a sample code) with what is on screen. A blank auth key field tests with the stored key. */
  sendTestSms(): void {
    const to = this.testSmsTo.value.trim();
    if (this.testingSms || !to || this.testSmsTo.invalid) {
      this.testSmsTo.markAsTouched();
      return;
    }

    this.testingSms = true;
    this.smsResult = null;
    this.delivery
      .testSms({ settings: this.buildRequest(), to })
      .pipe(finalize(() => (this.testingSms = false)))
      .subscribe({
        next: (result) => (this.smsResult = result),
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** What the form means as a request. Secrets: blank = null = keep what is stored; "Remove" = '' = clear it. */
  private buildRequest(): UpdatePlatformDeliverySettingsRequest {
    const raw = this.form.getRawValue();
    return {
      publicUrl: raw.publicUrl.trim(),
      smtpHost: raw.smtpHost.trim(),
      smtpPort: Number(raw.smtpPort),
      smtpUser: raw.smtpUser.trim(),
      smtpFrom: raw.smtpFrom.trim(),
      smtpEnableSsl: raw.smtpEnableSsl,
      smtpPassword: raw.removeSmtpPassword ? '' : raw.smtpPassword.trim() || null,
      smsEnabled: raw.smsEnabled,
      smsOtpTemplateId: raw.smsOtpTemplateId.trim(),
      smsBaseUrl: raw.smsBaseUrl.trim(),
      smsAuthKey: raw.removeSmsAuthKey ? '' : raw.smsAuthKey.trim() || null,
    };
  }

  private apply(settings: PlatformDeliverySettings): void {
    this.current = settings;
    this.form.reset({
      publicUrl: settings.publicUrl,
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpFrom: settings.smtpFrom,
      smtpEnableSsl: settings.smtpEnableSsl,
      smtpPassword: '',
      removeSmtpPassword: false,
      smsEnabled: settings.smsEnabled,
      smsOtpTemplateId: settings.smsOtpTemplateId,
      smsBaseUrl: settings.smsBaseUrl,
      smsAuthKey: '',
      removeSmsAuthKey: false,
    });
  }
}
