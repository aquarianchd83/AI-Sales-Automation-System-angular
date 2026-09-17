import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DiscoveredLead,
  LeadDiscoveryProfile,
  LeadDiscoveryRun,
  LeadDiscoverySpend,
  SaveLeadDiscoveryProfileRequest,
} from '../models/lead-discovery.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

/** The tenant's lead discovery profile (tenant Admin only — a run spends the tenant's AI credit) and
 * the leads the lead-discovery job has found (any tenant user). Runs themselves happen on the job's
 * schedule; there is no "run now" for a tenant. */
@Injectable({ providedIn: 'root' })
export class LeadDiscoveryService {
  private readonly baseUrl = `${environment.apiBaseUrl}/lead-discovery`;

  constructor(private readonly http: HttpClient) {}

  getProfile(): Observable<LeadDiscoveryProfile> {
    return this.http.get<LeadDiscoveryProfile>(`${this.baseUrl}/profile`);
  }

  /** Fails with PlanLimitExceeded when batchSize is above the plan's per-run cap. */
  saveProfile(request: SaveLeadDiscoveryProfileRequest): Observable<LeadDiscoveryProfile> {
    return this.http.put<LeadDiscoveryProfile>(`${this.baseUrl}/profile`, request);
  }

  /** Newest first. Search matches business name, type or city; minScore keeps leads scoring at least
   * that much. */
  getLeads(query: PagedQuery, minScore?: number | null): Observable<PagedResult<DiscoveredLead>> {
    const params = {
      ...toPagedParams(query),
      ...(minScore != null ? { minScore: String(minScore) } : {}),
    };
    return this.http.get<PagedResult<DiscoveredLead>>(`${this.baseUrl}/leads`, { params });
  }

  /** This month's and all-time discovery spend. Admin only — it is spend. */
  getSpend(): Observable<LeadDiscoverySpend> {
    return this.http.get<LeadDiscoverySpend>(`${this.baseUrl}/spend`);
  }

  /** What each run cost and produced, newest first. Admin only. */
  getRuns(query: PagedQuery): Observable<PagedResult<LeadDiscoveryRun>> {
    return this.http.get<PagedResult<LeadDiscoveryRun>>(`${this.baseUrl}/runs`, {
      params: toPagedParams(query),
    });
  }
}
