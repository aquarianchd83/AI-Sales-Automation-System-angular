import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { TenantWhatsAppConfig, UpdateTenantWhatsAppConfigRequest, isWhatsAppVerified } from '../../../core/models/tenant-settings.model';
import { NotificationService } from '../../../core/services/notification.service';

export type WhatsAppConnectionState = 'not-configured' | 'unverified' | 'failed' | 'verified';

/**
 * A WhatsApp Business connection: the credentials, where the connection stands, Save and Verify connection.
 * Shared by the tenant's own Settings page (also the onboarding wizard's WhatsApp step) and the Platform Admin
 * Console - both own the same connection, so both edit it with the same form. The host decides where it is saved
 * by passing `save` and `verify`.
 *
 * Secrets are never shown. A blank secret field leaves the stored value alone; typing one replaces it.
 */
@Component({
  selector: 'app-whatsapp-connection-form',
  templateUrl: './whatsapp-connection-form.component.html',
  styleUrls: ['./whatsapp-connection-form.component.scss'],
})
export class WhatsAppConnectionFormComponent implements OnChanges {
  @Input() config: TenantWhatsAppConfig | null = null;
  @Input() save!: (request: UpdateTenantWhatsAppConfigRequest) => Observable<TenantWhatsAppConfig>;
  @Input() verify!: () => Observable<TenantWhatsAppConfig>;
  /** The connection after a save or a verification. */
  @Output() changed = new EventEmitter<TenantWhatsAppConfig>();

  readonly form = this.fb.group({
    phoneNumberId: ['', Validators.required],
    whatsAppBusinessAccountId: ['', Validators.required],
    accessToken: [''],
    appSecret: [''],
    appId: [''],
    webhookVerifyToken: [''],
    apiVersion: ['v19.0'],
    apiBaseUrl: ['https://graph.facebook.com/'],
  });

  saving = false;
  verifying = false;
  showAdvanced = false;

  constructor(private readonly fb: NonNullableFormBuilder, private readonly notify: NotificationService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config']) {
      this.reset();
    }
  }

  get state(): WhatsAppConnectionState {
    if (!this.config?.isConnected) {
      return 'not-configured';
    }
    if (isWhatsAppVerified(this.config)) {
      return 'verified';
    }
    return this.config.verificationError ? 'failed' : 'unverified';
  }

  /** Verification checks what is saved, so unsaved edits have to be saved first. */
  get canVerify(): boolean {
    return !!this.config?.isConnected && !this.form.dirty && !this.saving && !this.verifying;
  }

  onSave(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.config?.hasAccessToken && !this.form.controls.accessToken.value) {
      this.notify.error('Enter the access token.');
      return;
    }
    if (!this.config?.hasAppSecret && !this.form.controls.appSecret.value) {
      this.notify.error('Enter the app secret.');
      return;
    }

    const raw = this.form.getRawValue();
    const request: UpdateTenantWhatsAppConfigRequest = {
      phoneNumberId: raw.phoneNumberId.trim(),
      whatsAppBusinessAccountId: raw.whatsAppBusinessAccountId.trim(),
      apiVersion: raw.apiVersion || undefined,
      apiBaseUrl: raw.apiBaseUrl || undefined,
      appId: raw.appId || undefined,
    };
    // Only a newly typed secret is sent; a blank field means "keep what is stored".
    if (raw.accessToken) {
      request.accessToken = raw.accessToken.trim();
    }
    if (raw.appSecret) {
      request.appSecret = raw.appSecret.trim();
    }
    if (raw.webhookVerifyToken) {
      request.webhookVerifyToken = raw.webhookVerifyToken.trim();
    }

    this.saving = true;
    this.save(request)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (config) => {
          this.config = config;
          this.reset();
          this.changed.emit(config);
          this.notify.success('WhatsApp connection saved. Now verify it.');
        },
        error: () => undefined, // the error interceptor shows why
      });
  }

  onVerify(): void {
    if (!this.canVerify) {
      return;
    }
    this.verifying = true;
    this.verify()
      .pipe(finalize(() => (this.verifying = false)))
      .subscribe({
        next: (config) => {
          this.config = config;
          this.changed.emit(config);
          if (isWhatsAppVerified(config)) {
            this.notify.success('WhatsApp is connected.');
          } else {
            this.notify.error(config.verificationError || 'Meta did not confirm the connection.');
          }
        },
        error: () => undefined,
      });
  }

  private reset(): void {
    const c = this.config;
    this.form.reset({
      phoneNumberId: c?.phoneNumberId ?? '',
      whatsAppBusinessAccountId: c?.whatsAppBusinessAccountId ?? '',
      accessToken: '',
      appSecret: '',
      appId: c?.appId ?? '',
      webhookVerifyToken: '',
      apiVersion: c?.apiVersion || 'v19.0',
      apiBaseUrl: c?.apiBaseUrl || 'https://graph.facebook.com/',
    });
  }
}
