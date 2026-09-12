import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantProfile, UpdateTenantTimezoneRequest } from '../models/tenant-profile.model';

/** A tenant's own editable profile — just Timezone for now. Self-service counterpart to the
 * Platform Admin Console's tenant detail override (PlatformTenantService.updateTimezone) — both
 * write the same backend column, neither is the sole owner of it. */
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
}
