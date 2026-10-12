import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  StudioActivity,
  StudioActivityQuery,
  StudioOverview,
  StudioSettings,
} from '../models/content-studio.model';
import { PagedResult, toPagedParams } from '../models/paged-result.model';

/** The tenant's AI Content Studio (Admin only): what it has spent and on what, and the studio's own settings. */
@Injectable({ providedIn: 'root' })
export class ContentStudioService {
  private readonly baseUrl = `${environment.apiBaseUrl}/content-studio`;

  constructor(private readonly http: HttpClient) {}

  /** Whether the platform has switched the studio on, the studio balances, and the last 30 days' totals. */
  getOverview(): Observable<StudioOverview> {
    return this.http.get<StudioOverview>(`${this.baseUrl}/overview`);
  }

  /** Every metered step, newest first. */
  getActivity(query: StudioActivityQuery): Observable<PagedResult<StudioActivity>> {
    let params = new HttpParams({ fromObject: toPagedParams(query) });
    if (query.kind != null) {
      params = params.set('Kind', String(query.kind));
    }
    if (query.status != null) {
      params = params.set('Status', String(query.status));
    }
    if (query.quotaType != null) {
      params = params.set('QuotaType', String(query.quotaType));
    }
    if (query.fromUtc) {
      params = params.set('FromUtc', query.fromUtc);
    }
    if (query.toUtc) {
      params = params.set('ToUtc', query.toUtc);
    }
    return this.http.get<PagedResult<StudioActivity>>(`${this.baseUrl}/activity`, { params });
  }

  getSettings(): Observable<StudioSettings> {
    return this.http.get<StudioSettings>(`${this.baseUrl}/settings`);
  }

  updateSettings(settings: StudioSettings): Observable<StudioSettings> {
    return this.http.put<StudioSettings>(`${this.baseUrl}/settings`, settings);
  }
}
