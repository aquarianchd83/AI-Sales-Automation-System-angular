import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  TenantProfile,
  UpdateTenantCountryRequest,
  UpdateTenantTimezoneRequest,
} from '../models/tenant-profile.model';

/** A tenant's own editable profile — Timezone and Country. Self-service counterpart to the
 * Platform Admin Console's tenant detail overrides (PlatformTenantService.updateTimezone/
 * updateCountry) — both write the same backend columns, neither is the sole owner of either. */
@Injectable({ providedIn: 'root' })
export class TenantProfileService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tenant-profile`;

  constructor(private readonly http: HttpClient) {}

  getProfile(): Observable<TenantProfile> {
    return this.http.get<TenantProfile>(this.baseUrl);
  }

  updateTimezone(timezone: string): Observable<TenantProfile> {
    const request: UpdateTenantTimezoneRequest = { timezone };
    return this.http.put<TenantProfile>(`${this.baseUrl}/timezone`, request);
  }

  /** Fixes a tenant's plan pricing currency (RegionalPricingCatalog.Resolve on the backend) when
   * it's showing USD because countryCode was never set at signup. */
  updateCountry(countryCode: string): Observable<TenantProfile> {
    const request: UpdateTenantCountryRequest = { countryCode };
    return this.http.put<TenantProfile>(`${this.baseUrl}/country`, request);
  }
}
