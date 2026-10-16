import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import {
  DeliveryTestResult,
  IntegrationChannel,
  IntegrationChannelRequest,
  IntegrationMode,
  PlatformIntegrationSettings,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformIntegrationSettingsService } from '../../../core/services/platform-integration-settings.service';

export type IntegrationChannelKey = 'consentSms' | 'dndCheck';

/**
 * The Platform Admin Console's Integrations page: for each outside service - the WhatsApp consent SMS and the DND check - whether it is
 * handled by the built-in simulator (nothing leaves the platform) or by a third-party API. Saved to the database only, the API keys
 * encrypted at rest and never shown again: a blank key field keeps the stored one, and "Remove" clears it. The test buttons make one real
 * call with what is on screen, saved or not.
 */
@Component({
  selector: 'app-platform-integration-settings',
  templateUrl: './platform-integration-settings.component.html',
  styleUrls: ['./platform-integration-settings.component.scss'],
})
export class PlatformIntegrationSettingsComponent implements OnInit {
  readonly channels: { key: IntegrationChannelKey; title: string; description: string; testLabel: string; testIcon: string }[] = [
    {
      key: 'consentSms',
      title: 'Consent SMS',
      description: 'The SMS that invites a discovered customer to start a WhatsApp conversation.',
      testLabel: 'Send test SMS',
      testIcon: 'sms',
    },
    {
      key: 'dndCheck',
      title: 'DND check',
      description: 'Checks whether a discovered mobile number may be contacted (Do Not Disturb and similar restrictions).',
      testLabel: 'Check this number',
      testIcon: 'verified_user',
    },
  ];

  readonly form = this.fb.group({
    consentSms: this.channelGroup(),
    dndCheck: this.channelGroup(),
  });

  /** Where the test calls go. Not part of the settings, so outside the form (and its "unsaved changes" state). */
  readonly testTo = {
    consentSms: this.fb.control('', [Validators.pattern(/^\+[0-9 ()-]{8,20}$/)]),
    dndCheck: this.fb.control('', [Validators.pattern(/^\+[0-9 ()-]{8,20}$/)]),
  };

  current: PlatformIntegrationSettings | null = null;
  loading = true;
  loadFailed = false;
  saving = false;
  testing: Record<IntegrationChannelKey, boolean> = { consentSms: false, dndCheck: false };
  /** Outcomes of the last tests; cleared as soon as the form changes, since they no longer describe what is on screen. */
  results: Record<IntegrationChannelKey, DeliveryTestResult | null> = { consentSms: null, dndCheck: null };

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly integrations: PlatformIntegrationSettingsService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.form.valueChanges.subscribe(() => (this.results = { consentSms: null, dndCheck: null }));
  }

  isApi(key: IntegrationChannelKey): boolean {
    return this.form.controls[key].controls.mode.value === 'Api';
  }

  removingKey(key: IntegrationChannelKey): boolean {
    return this.form.controls[key].controls.removeApiKey.value;
  }

  /** The last four characters of a stored key, never the value. */
  storedHint(key: IntegrationChannelKey): string | null {
    const channel = this.current?.[key];
    return channel?.hasApiKey ? channel.apiKeyHint ?? 'set' : null;
  }

  hasStoredKey(key: IntegrationChannelKey): boolean {
    return !!this.current?.[key].hasApiKey;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.integrations
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
    this.integrations
      .save({ consentSms: this.buildRequest('consentSms'), dndCheck: this.buildRequest('dndCheck') })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (settings) => {
          this.notify.success('Integration settings saved. They apply from the next request - no restart needed.');
          this.apply(settings);
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Makes one real call with what is on screen. A blank key field tests with the stored key. */
  test(key: IntegrationChannelKey): void {
    const control = this.testTo[key];
    const to = control.value.trim();
    if (this.testing[key] || !to || control.invalid) {
      control.markAsTouched();
      return;
    }

    this.testing[key] = true;
    this.results[key] = null;
    const request = { settings: this.buildRequest(key), to };
    const call = key === 'consentSms' ? this.integrations.testConsentSms(request) : this.integrations.testDndCheck(request);
    call.pipe(finalize(() => (this.testing[key] = false))).subscribe({
      next: (result) => (this.results[key] = result),
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  private channelGroup() {
    return this.fb.group({
      mode: this.fb.control<IntegrationMode>('Simulator'),
      apiUrl: ['', [Validators.pattern(/^https:\/\/\S+$/i)]],
      apiKeyHeader: ['Authorization', [Validators.pattern(/^[A-Za-z0-9_-]*$/)]],
      senderId: '',
      timeoutSeconds: [15, [Validators.required, Validators.min(1), Validators.max(120)]],
      apiKey: '',
      removeApiKey: false,
    });
  }

  /** What one channel's form means as a request. Key: blank = null = keep what is stored; "Remove" = '' = clear it. */
  private buildRequest(key: IntegrationChannelKey): IntegrationChannelRequest {
    const raw = this.form.controls[key].getRawValue();
    return {
      mode: raw.mode,
      apiUrl: raw.apiUrl.trim(),
      apiKey: raw.removeApiKey ? '' : raw.apiKey.trim() || null,
      apiKeyHeader: raw.apiKeyHeader.trim() || 'Authorization',
      senderId: raw.senderId.trim(),
      timeoutSeconds: Number(raw.timeoutSeconds),
    };
  }

  private apply(settings: PlatformIntegrationSettings): void {
    this.current = settings;
    const values = (channel: IntegrationChannel) => ({
      mode: channel.mode,
      apiUrl: channel.apiUrl,
      apiKeyHeader: channel.apiKeyHeader,
      senderId: channel.senderId,
      timeoutSeconds: channel.timeoutSeconds,
      apiKey: '',
      removeApiKey: false,
    });
    this.form.reset({ consentSms: values(settings.consentSms), dndCheck: values(settings.dndCheck) });
  }
}
