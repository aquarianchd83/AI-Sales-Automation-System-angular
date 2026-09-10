import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  AI_CHAT_PROVIDERS,
  AI_EMBEDDING_PROVIDERS,
  TenantAiProviderConfig,
  UpdateTenantAiProviderConfigRequest,
} from '../../../core/models/tenant-settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';

export interface PlatformTenantAiConfigDialogData {
  tenantId: string;
  tenantName: string;
  config: TenantAiProviderConfig | null;
}

/** PlatformSuperAdmin-only editor for one tenant's AI provider choice and API keys - same fields/
 * masking convention as the old tenant self-service form (TenantSettingsListComponent), just scoped
 * by tenantId and reached from the Platform Admin Console instead. */
@Component({
  selector: 'app-platform-tenant-ai-config-dialog',
  templateUrl: './platform-tenant-ai-config-dialog.component.html',
  styles: [
    `
      .tab-intro {
        display: block;
        font-size: 12px;
        padding-bottom: 12px;
      }
    `,
  ],
})
export class PlatformTenantAiConfigDialogComponent {
  readonly chatProviders = AI_CHAT_PROVIDERS;
  readonly embeddingProviders = AI_EMBEDDING_PROVIDERS;

  readonly form = this.fb.group({
    provider: [this.data.config?.provider ?? 'Simulated'],
    embeddingProvider: [this.data.config?.embeddingProvider ?? 'Simulated'],
    anthropicApiKey: [''],
    anthropicModel: [this.data.config?.anthropicModel ?? ''],
    openAiApiKey: [''],
    openAiChatModel: [this.data.config?.openAiChatModel ?? ''],
    openAiEmbeddingModel: [this.data.config?.openAiEmbeddingModel ?? ''],
    googleApiKey: [''],
    googleChatModel: [this.data.config?.googleChatModel ?? ''],
    googleEmbeddingModel: [this.data.config?.googleEmbeddingModel ?? ''],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly configService: PlatformTenantConfigService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformTenantAiConfigDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformTenantAiConfigDialogData
  ) {}

  save(): void {
    if (this.saving) {
      return;
    }

    const raw = this.form.getRawValue();
    const request: UpdateTenantAiProviderConfigRequest = {
      provider: raw.provider || undefined,
      embeddingProvider: raw.embeddingProvider || undefined,
      anthropicModel: raw.anthropicModel || undefined,
      openAiChatModel: raw.openAiChatModel || undefined,
      openAiEmbeddingModel: raw.openAiEmbeddingModel || undefined,
      googleChatModel: raw.googleChatModel || undefined,
      googleEmbeddingModel: raw.googleEmbeddingModel || undefined,
    };
    if (this.form.controls.anthropicApiKey.dirty && raw.anthropicApiKey) {
      request.anthropicApiKey = raw.anthropicApiKey;
    }
    if (this.form.controls.openAiApiKey.dirty && raw.openAiApiKey) {
      request.openAiApiKey = raw.openAiApiKey;
    }
    if (this.form.controls.googleApiKey.dirty && raw.googleApiKey) {
      request.googleApiKey = raw.googleApiKey;
    }

    this.saving = true;
    this.configService
      .saveAiConfig(this.data.tenantId, request)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.notify.success('AI provider configuration saved.');
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
