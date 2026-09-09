import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  TenantAiProviderConfig,
  TenantWhatsAppConfig,
  UpdateTenantAiProviderConfigRequest,
  UpdateTenantWhatsAppConfigRequest,
} from '../models/tenant-settings.model';

/**
 * A tenant's own self-service settings: their WhatsApp Business Account credentials and AI
 * provider choice/API keys (SaaS conversion Phase B) — the BYO-WABA/BYO-API-key equivalent of
 * SettingsService, but scoped to the caller's own tenant rather than platform-wide.
 */
@Injectable({ providedIn: 'root' })
export class TenantSettingsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tenant-settings`;

  constructor(private readonly http: HttpClient) {}

  /** Null when the tenant has never configured a WABA — a normal state for a new trial tenant,
   * not a missing resource. */
  getWhatsAppConfig(): Observable<TenantWhatsAppConfig | null> {
    return this.http.get<TenantWhatsAppConfig | null>(`${this.baseUrl}/whatsapp`);
  }

  saveWhatsAppConfig(request: UpdateTenantWhatsAppConfigRequest): Observable<TenantWhatsAppConfig> {
    return this.http.put<TenantWhatsAppConfig>(`${this.baseUrl}/whatsapp`, request);
  }

  /** Null when the tenant has never configured one — defaults to Simulated for both Provider and
   * EmbeddingProvider in that case. */
  getAiConfig(): Observable<TenantAiProviderConfig | null> {
    return this.http.get<TenantAiProviderConfig | null>(`${this.baseUrl}/ai`);
  }

  saveAiConfig(request: UpdateTenantAiProviderConfigRequest): Observable<TenantAiProviderConfig> {
    return this.http.put<TenantAiProviderConfig>(`${this.baseUrl}/ai`, request);
  }
}
