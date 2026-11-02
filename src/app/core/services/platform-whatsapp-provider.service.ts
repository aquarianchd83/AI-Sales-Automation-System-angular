import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantWhatsAppProvider, WhatsAppProviderSettings } from '../models/platform-whatsapp-provider.model';

@Injectable({ providedIn: 'root' })
export class PlatformWhatsAppProviderService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/whatsapp-provider`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<WhatsAppProviderSettings> {
    return this.http.get<WhatsAppProviderSettings>(this.baseUrl);
  }

  /** An invalid or unavailable choice answers 400 and leaves the active provider as it was. */
  save(provider: string): Observable<WhatsAppProviderSettings> {
    return this.http.put<WhatsAppProviderSettings>(this.baseUrl, { provider });
  }

  getForTenant(tenantId: string): Observable<TenantWhatsAppProvider> {
    return this.http.get<TenantWhatsAppProvider>(`${this.baseUrl}/tenants/${tenantId}`);
  }

  /** null clears the tenant's own choice so it follows the platform default. */
  saveForTenant(tenantId: string, provider: string | null): Observable<TenantWhatsAppProvider> {
    return this.http.put<TenantWhatsAppProvider>(`${this.baseUrl}/tenants/${tenantId}`, { provider });
  }
}
