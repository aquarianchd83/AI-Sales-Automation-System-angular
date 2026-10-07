import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  KeywordSuggestions,
  RefineDescriptionRequest,
  RefinedDescription,
  SuggestKeywordsRequest,
  TenantProfile,
  UpdateTenantBusinessProfileRequest,
  UpdateTenantCountryRequest,
  UpdateTenantTimezoneRequest,
} from '../models/tenant-profile.model';

/** A tenant's own editable profile — business details, Timezone and Country. Timezone and Country are
 * also overridable from the Platform Admin Console's tenant detail (PlatformTenantService.updateTimezone/
 * updateCountry) — both write the same backend columns, neither is the sole owner of either. */
@Injectable({ providedIn: 'root' })
export class TenantProfileService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tenant-profile`;

  constructor(private readonly http: HttpClient) {}

  getProfile(): Observable<TenantProfile> {
    return this.http.get<TenantProfile>(this.baseUrl);
  }

  updateBusinessProfile(request: UpdateTenantBusinessProfileRequest): Observable<TenantProfile> {
    return this.http.put<TenantProfile>(this.baseUrl, request);
  }

  /** Domain keywords for an industry - from the tenant's own AI when it has one, else common terms. Saves nothing. */
  /** Nothing is saved: the screen shows the result and the tenant decides whether to use it. */
  refineDescription(request: RefineDescriptionRequest): Observable<RefinedDescription> {
    return this.http.post<RefinedDescription>(`${this.baseUrl}/description-refinement`, request);
  }

  suggestKeywords(request: SuggestKeywordsRequest): Observable<KeywordSuggestions> {
    return this.http.post<KeywordSuggestions>(`${this.baseUrl}/keyword-suggestions`, request);
  }

  updateTimezone(timezone: string): Observable<TenantProfile> {
    const request: UpdateTenantTimezoneRequest = { timezone };
    return this.http.put<TenantProfile>(`${this.baseUrl}/timezone`, request);
  }

  /** Fixes a tenant's plan pricing currency (RegionalPricingCatalog.Resolve on the backend) when
   * it's showing USD because countryCode was never set at signup. */
  updateCountry(countryCode: string, stateCode?: string | null): Observable<TenantProfile> {
    const request: UpdateTenantCountryRequest = { countryCode, stateCode: stateCode || null };
    return this.http.put<TenantProfile>(`${this.baseUrl}/country`, request);
  }
}
