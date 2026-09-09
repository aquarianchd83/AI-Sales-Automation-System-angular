import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';
import {
  AI_CHAT_PROVIDERS,
  AI_EMBEDDING_PROVIDERS,
  TenantAiProviderConfig,
  TenantWhatsAppConfig,
  UpdateTenantAiProviderConfigRequest,
  UpdateTenantWhatsAppConfigRequest,
} from '../../../core/models/tenant-settings.model';

/**
 * A tenant's own WhatsApp Business Account credentials and AI provider setup (SaaS conversion
 * Phase B) — the BYO-WABA/BYO-API-key equivalent of the platform-wide Configuration screen, but
 * for this tenant's own two settings groups specifically, not an arbitrary catalog.
 */
@Component({
  selector: 'app-tenant-settings-list',
  templateUrl: './tenant-settings-list.component.html',
  styleUrls: ['./tenant-settings-list.component.scss'],
})
export class TenantSettingsListComponent implements OnInit {
  readonly chatProviders = AI_CHAT_PROVIDERS;
  readonly embeddingProviders = AI_EMBEDDING_PROVIDERS;

  loadingWhatsApp = true;
  loadingAi = true;
  savingWhatsApp = false;
  savingAi = false;

  whatsAppConfig: TenantWhatsAppConfig | null = null;
  aiConfig: TenantAiProviderConfig | null = null;

  readonly whatsAppForm = this.fb.group({
    phoneNumberId: ['', Validators.required],
    whatsAppBusinessAccountId: ['', Validators.required],
    accessToken: [''],
    appSecret: [''],
    apiVersion: [''],
    apiBaseUrl: [''],
  });

  readonly aiForm = this.fb.group({
    provider: ['Simulated'],
    embeddingProvider: ['Simulated'],
    anthropicApiKey: [''],
    anthropicModel: [''],
    openAiApiKey: [''],
    openAiChatModel: [''],
    openAiEmbeddingModel: [''],
    googleApiKey: [''],
    googleChatModel: [''],
    googleEmbeddingModel: [''],
  });

  constructor(
    private readonly tenantSettings: TenantSettingsService,
    private readonly fb: NonNullableFormBuilder,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadWhatsApp();
    this.loadAi();
  }

  saveWhatsApp(): void {
    if (this.whatsAppForm.invalid) {
      this.whatsAppForm.markAllAsTouched();
      return;
    }

    const raw = this.whatsAppForm.getRawValue();
    const request: UpdateTenantWhatsAppConfigRequest = {
      phoneNumberId: raw.phoneNumberId,
      whatsAppBusinessAccountId: raw.whatsAppBusinessAccountId,
      apiVersion: raw.apiVersion || undefined,
      apiBaseUrl: raw.apiBaseUrl || undefined,
    };
    // Only ever sends a NEW secret, never an explicit clear — same convention as the platform
    // Configuration screen (SettingsListComponent.save): a blank, untouched secret field means
    // "leave the stored value alone", not "wipe it".
    if (this.whatsAppForm.controls.accessToken.dirty && raw.accessToken) {
      request.accessToken = raw.accessToken;
    }
    if (this.whatsAppForm.controls.appSecret.dirty && raw.appSecret) {
      request.appSecret = raw.appSecret;
    }

    this.savingWhatsApp = true;
    this.tenantSettings
      .saveWhatsAppConfig(request)
      .pipe(finalize(() => (this.savingWhatsApp = false)))
      .subscribe({
        next: (config) => {
          this.notify.success('WhatsApp settings saved.');
          this.applyWhatsAppConfig(config);
        },
      });
  }

  saveAi(): void {
    const raw = this.aiForm.getRawValue();
    const request: UpdateTenantAiProviderConfigRequest = {
      provider: raw.provider || undefined,
      embeddingProvider: raw.embeddingProvider || undefined,
      anthropicModel: raw.anthropicModel || undefined,
      openAiChatModel: raw.openAiChatModel || undefined,
      openAiEmbeddingModel: raw.openAiEmbeddingModel || undefined,
      googleChatModel: raw.googleChatModel || undefined,
      googleEmbeddingModel: raw.googleEmbeddingModel || undefined,
    };
    if (this.aiForm.controls.anthropicApiKey.dirty && raw.anthropicApiKey) {
      request.anthropicApiKey = raw.anthropicApiKey;
    }
    if (this.aiForm.controls.openAiApiKey.dirty && raw.openAiApiKey) {
      request.openAiApiKey = raw.openAiApiKey;
    }
    if (this.aiForm.controls.googleApiKey.dirty && raw.googleApiKey) {
      request.googleApiKey = raw.googleApiKey;
    }

    this.savingAi = true;
    this.tenantSettings
      .saveAiConfig(request)
      .pipe(finalize(() => (this.savingAi = false)))
      .subscribe({
        next: (config) => {
          this.notify.success('AI settings saved.');
          this.applyAiConfig(config);
        },
      });
  }

  private loadWhatsApp(): void {
    this.loadingWhatsApp = true;
    this.tenantSettings.getWhatsAppConfig().subscribe({
      next: (config) => {
        this.applyWhatsAppConfig(config);
        this.loadingWhatsApp = false;
      },
      error: () => (this.loadingWhatsApp = false),
    });
  }

  private loadAi(): void {
    this.loadingAi = true;
    this.tenantSettings.getAiConfig().subscribe({
      next: (config) => {
        this.applyAiConfig(config);
        this.loadingAi = false;
      },
      error: () => (this.loadingAi = false),
    });
  }

  private applyWhatsAppConfig(config: TenantWhatsAppConfig | null): void {
    this.whatsAppConfig = config;
    this.whatsAppForm.reset({
      phoneNumberId: config?.phoneNumberId ?? '',
      whatsAppBusinessAccountId: config?.whatsAppBusinessAccountId ?? '',
      accessToken: '',
      appSecret: '',
      apiVersion: config?.apiVersion ?? 'v19.0',
      apiBaseUrl: config?.apiBaseUrl ?? 'https://graph.facebook.com/',
    });
  }

  private applyAiConfig(config: TenantAiProviderConfig | null): void {
    this.aiConfig = config;
    this.aiForm.reset({
      provider: config?.provider ?? 'Simulated',
      embeddingProvider: config?.embeddingProvider ?? 'Simulated',
      anthropicApiKey: '',
      anthropicModel: config?.anthropicModel ?? '',
      openAiApiKey: '',
      openAiChatModel: config?.openAiChatModel ?? '',
      openAiEmbeddingModel: config?.openAiEmbeddingModel ?? '',
      googleApiKey: '',
      googleChatModel: config?.googleChatModel ?? '',
      googleEmbeddingModel: config?.googleEmbeddingModel ?? '',
    });
  }
}
