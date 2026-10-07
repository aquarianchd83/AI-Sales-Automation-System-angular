import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  TenantSettingCategory,
  TenantWhatsAppConfig,
  UpdateTenantSettingsRequest,
  UpdateTenantWhatsAppConfigRequest,
} from '../models/tenant-settings.model';

/**
 * Where a tenant's WhatsApp Business Account credentials and AI provider config now get created,
 * edited and deleted from — PlatformSuperAdmin-only (see the backend's PlatformTenantConfigController
 * doc comment for why this moved off the tenant's own self-service settings screen). Reuses the same
 * DTOs as TenantSettingsService since the shapes are identical; only who can write through them
 * changed.
 */
@Injectable({ providedIn: 'root' })
export class PlatformTenantConfigService {
  private baseUrl(tenantId: string): string {
    return `${environment.apiBaseUrl}/platform/tenants/${tenantId}`;
  }

  constructor(private readonly http: HttpClient) {}

  getWhatsAppConfig(tenantId: string): Observable<TenantWhatsAppConfig | null> {
    return this.http.get<TenantWhatsAppConfig | null>(`${this.baseUrl(tenantId)}/whatsapp-config`);
  }

  saveWhatsAppConfig(tenantId: string, request: UpdateTenantWhatsAppConfigRequest): Observable<TenantWhatsAppConfig> {
    return this.http.put<TenantWhatsAppConfig>(`${this.baseUrl(tenantId)}/whatsapp-config`, request);
  }

  /** Asks Meta whether the saved credentials reach the phone number; the answer comes back on the config. */
  verifyWhatsAppConfig(tenantId: string): Observable<TenantWhatsAppConfig> {
    return this.http.post<TenantWhatsAppConfig>(`${this.baseUrl(tenantId)}/whatsapp-config/verify`, {});
  }

  deleteWhatsAppConfig(tenantId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(tenantId)}/whatsapp-config`);
  }

  getConfigOverrides(tenantId: string): Observable<TenantSettingCategory[]> {
    return this.http.get<TenantSettingCategory[]>(`${this.baseUrl(tenantId)}/config-overrides`);
  }

  saveConfigOverrides(tenantId: string, request: UpdateTenantSettingsRequest): Observable<TenantSettingCategory[]> {
    return this.http.put<TenantSettingCategory[]>(`${this.baseUrl(tenantId)}/config-overrides`, request);
  }

  deleteConfigOverrides(tenantId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl(tenantId)}/config-overrides`);
  }
}
