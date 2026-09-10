import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import {
  CreatePlatformTenantRequest,
  ImpersonationSession,
  OverrideTenantPlanRequest,
  PlatformTenantDetail,
  PlatformTenantListItem,
  PlatformTenantQuery,
} from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformTenantService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/tenants`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformTenantQuery): Observable<PagedResult<PlatformTenantListItem>> {
    return this.http.get<PagedResult<PlatformTenantListItem>>(this.baseUrl, {
      params: {
        ...toPagedParams(query),
        ...(query.status != null ? { Status: String(query.status) } : {}),
      },
    });
  }

  getById(id: string): Observable<PlatformTenantDetail> {
    return this.http.get<PlatformTenantDetail>(`${this.baseUrl}/${id}`);
  }

  /** Operator-initiated tenant creation — same shape as self-serve signup, but the
   * PlatformSuperAdmin sets a temporary admin password to hand off rather than the new admin
   * choosing their own. */
  create(request: CreatePlatformTenantRequest): Observable<PlatformTenantDetail> {
    return this.http.post<PlatformTenantDetail>(this.baseUrl, request);
  }

  suspend(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/suspend`, {});
  }

  reactivate(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/reactivate`, {});
  }

  /** Terminal status change only, never a physical delete — see the backend's
   * TenantStatus.Deleted doc comment. */
  delete(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/delete`, {});
  }

  /** Issues a short-lived (30 min), no-refresh-token access token for the tenant's own admin -
   * audited on the backend. The caller (PlatformTenantListComponent/PlatformTenantDetailComponent)
   * is responsible for opening it in a new tab via ImpersonationSessionService, never for loading
   * it into the current session. */
  impersonate(id: string): Observable<ImpersonationSession> {
    return this.http.post<ImpersonationSession>(`${this.baseUrl}/${id}/impersonate`, {});
  }

  overridePlan(id: string, request: OverrideTenantPlanRequest): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/plan`, request);
  }
}
