import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { TenantWhatsAppConfig, UpdateTenantWhatsAppConfigRequest } from '../../../core/models/tenant-settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';

export interface PlatformTenantWhatsAppConfigDialogData {
  tenantId: string;
  tenantName: string;
  config: TenantWhatsAppConfig | null;
}

/** PlatformSuperAdmin-only editor for one tenant's WhatsApp Business Account credentials - same
 * fields/masking convention as the old tenant self-service form (TenantSettingsListComponent), just
 * scoped by tenantId and reached from the Platform Admin Console instead. */
@Component({
  selector: 'app-platform-tenant-whatsapp-config-dialog',
  templateUrl: './platform-tenant-whatsapp-config-dialog.component.html',
  styles: [
    `
      .note {
        margin: 8px 0 0;
        font-size: 12px;
      }
    `,
  ],
})
export class PlatformTenantWhatsAppConfigDialogComponent {
  readonly form = this.fb.group({
    phoneNumberId: [this.data.config?.phoneNumberId ?? '', Validators.required],
    whatsAppBusinessAccountId: [this.data.config?.whatsAppBusinessAccountId ?? '', Validators.required],
    accessToken: [''],
    appSecret: [''],
    webhookVerifyToken: [''],
    appId: [this.data.config?.appId ?? ''],
    apiVersion: [this.data.config?.apiVersion ?? 'v19.0'],
    apiBaseUrl: [this.data.config?.apiBaseUrl ?? 'https://graph.facebook.com/'],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly configService: PlatformTenantConfigService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformTenantWhatsAppConfigDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformTenantWhatsAppConfigDialogData
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: UpdateTenantWhatsAppConfigRequest = {
      phoneNumberId: raw.phoneNumberId,
      whatsAppBusinessAccountId: raw.whatsAppBusinessAccountId,
      apiVersion: raw.apiVersion || undefined,
      apiBaseUrl: raw.apiBaseUrl || undefined,
      appId: raw.appId || undefined,
    };
    // Only ever sends a NEW secret, never an explicit clear — a blank, untouched secret field means
    // "leave the stored value alone." Use Delete on the tenant detail screen to actually clear it.
    if (this.form.controls.accessToken.dirty && raw.accessToken) {
      request.accessToken = raw.accessToken;
    }
    if (this.form.controls.appSecret.dirty && raw.appSecret) {
      request.appSecret = raw.appSecret;
    }
    if (this.form.controls.webhookVerifyToken.dirty && raw.webhookVerifyToken) {
      request.webhookVerifyToken = raw.webhookVerifyToken;
    }

    this.saving = true;
    this.configService
      .saveWhatsAppConfig(this.data.tenantId, request)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          // A new token or App Secret makes the API start the tenant's token refresh straight away —
          // a short-lived Meta token can only be exchanged for a 60-day one while it is still valid.
          this.notify.success(
            request.accessToken || request.appSecret
              ? 'WhatsApp configuration saved. Token refresh started — see Background Jobs for the result.'
              : 'WhatsApp configuration saved.'
          );
          this.dialogRef.close(true);
        },
        error: () => {
          /* ErrorInterceptor toasts it; keep the dialog open */
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
