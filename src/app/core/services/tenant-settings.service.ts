import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  TenantAiProviderConfig,
  TenantCharges,
  TenantMessageUsage,
  TenantWhatsAppConfig,
  TenantWhatsAppNumber,
  UpdateTenantWhatsAppConfigRequest,
} from '../models/tenant-settings.model';

/**
 * A tenant's own settings: its WhatsApp Business Account connection (owned jointly with the Platform Admin -
 * either side can save and verify it), a read-only view of the AI provider setup, and usage and charges.
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

  /** The WhatsApp number the tenant gave for its customers to message. */
  getWhatsAppNumber(): Observable<TenantWhatsAppNumber> {
    return this.http.get<TenantWhatsAppNumber>(`${this.baseUrl}/whatsapp-number`);
  }

  /** Saves just the number (blank clears it). Connecting it to WhatsApp is separate (saveWhatsAppConfig). */
  saveWhatsAppNumber(whatsAppNumber: string | null): Observable<TenantWhatsAppNumber> {
    return this.http.put<TenantWhatsAppNumber>(`${this.baseUrl}/whatsapp-number`, { whatsAppNumber });
  }

  /** Saves the tenant's own WhatsApp credentials. Clears any earlier verification - verify again afterwards. */
  saveWhatsAppConfig(request: UpdateTenantWhatsAppConfigRequest): Observable<TenantWhatsAppConfig> {
    return this.http.put<TenantWhatsAppConfig>(`${this.baseUrl}/whatsapp`, request);
  }

  /** Asks Meta whether the saved credentials reach the phone number; the answer comes back on the config. */
  verifyWhatsAppConfig(): Observable<TenantWhatsAppConfig> {
    return this.http.post<TenantWhatsAppConfig>(`${this.baseUrl}/whatsapp/verify`, {});
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
