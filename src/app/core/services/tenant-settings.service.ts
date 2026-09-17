import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  TenantAiProviderConfig,
  TenantCharges,
  TenantMessageUsage,
  TenantWhatsAppConfig,
} from '../models/tenant-settings.model';

/**
 * A tenant's own read-only view of its WhatsApp Business Account connection, AI provider setup, and
 * message usage (SaaS conversion Phase B). Connection/provider config used to be editable here too;
 * write access moved to the Platform Admin Console (see PlatformTenantConfigService) since both hold
 * real, security-sensitive credentials — see the backend's PlatformTenantConfigController doc comment
 * for why. This service only reads now.
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

  /** Null when the tenant has never configured one — defaults to Simulated for both Provider and
   * EmbeddingProvider in that case. */
  getAiConfig(): Observable<TenantAiProviderConfig | null> {
    return this.http.get<TenantAiProviderConfig | null>(`${this.baseUrl}/ai`);
  }

  /** How much of this calendar month's WhatsApp message quota the tenant has used. */
  getUsage(): Observable<TenantMessageUsage> {
    return this.http.get<TenantMessageUsage>(`${this.baseUrl}/usage`);
  }

  /** This calendar month's usage charges — WhatsApp sending plus lead discovery. Estimates from
   * hand-maintained rate tables, not a bill; see TenantCharges' own doc comment. */
  getCharges(): Observable<TenantCharges> {
    return this.http.get<TenantCharges>(`${this.baseUrl}/charges`);
  }
}
