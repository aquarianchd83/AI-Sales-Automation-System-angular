import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  BusinessFact,
  BusinessFactQuery,
  BusinessFactSummary,
  QuestionnaireCompletion,
  QuestionnaireState,
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

  /** Whether the studio is on for this tenant. Open to Admins and Sales Managers, so the sidenav can ask it for both. */
  getStatus(): Observable<{ enabled: boolean }> {
    return this.http.get<{ enabled: boolean }>(`${this.baseUrl}/status`);
  }

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

  // ----- questionnaire and business facts (Admin and Sales Manager) -----------------------------------------------------------------

  /** The questionnaire for this business, started and pre-filled from the business profile the first time it is asked for. */
  getQuestionnaire(): Observable<QuestionnaireState> {
    return this.http.get<QuestionnaireState>(`${this.baseUrl}/questionnaire`);
  }

  /** Only the keys present change; a null value clears that answer. */
  saveAnswers(answers: Record<string, unknown>): Observable<QuestionnaireState> {
    return this.http.put<QuestionnaireState>(`${this.baseUrl}/questionnaire/answers`, { answers });
  }

  completeQuestionnaire(): Observable<QuestionnaireCompletion> {
    return this.http.post<QuestionnaireCompletion>(`${this.baseUrl}/questionnaire/complete`, {});
  }

  /** Starts a fresh round on the newest version, carrying over the answers that still fit. */
  restartQuestionnaire(): Observable<QuestionnaireState> {
    return this.http.post<QuestionnaireState>(`${this.baseUrl}/questionnaire/restart`, {});
  }

  getFacts(query: BusinessFactQuery): Observable<PagedResult<BusinessFact>> {
    let params = new HttpParams({ fromObject: toPagedParams(query) });
    if (query.status != null) {
      params = params.set('Status', String(query.status));
    }
    if (query.sourceType != null) {
      params = params.set('SourceType', String(query.sourceType));
    }
    if (query.category) {
      params = params.set('Category', query.category);
    }
    return this.http.get<PagedResult<BusinessFact>>(`${this.baseUrl}/facts`, { params });
  }

  getFactSummary(): Observable<BusinessFactSummary> {
    return this.http.get<BusinessFactSummary>(`${this.baseUrl}/facts/summary`);
  }

  createFact(fact: { category: string; statement: string }): Observable<BusinessFact> {
    return this.http.post<BusinessFact>(`${this.baseUrl}/facts`, fact);
  }

  updateFact(id: string, fact: { category: string; statement: string }): Observable<BusinessFact> {
    return this.http.put<BusinessFact>(`${this.baseUrl}/facts/${id}`, fact);
  }

  /** Admin only: confirms the fact is true. */
  verifyFact(id: string): Observable<BusinessFact> {
    return this.http.post<BusinessFact>(`${this.baseUrl}/facts/${id}/verify`, {});
  }

  retireFact(id: string): Observable<BusinessFact> {
    return this.http.post<BusinessFact>(`${this.baseUrl}/facts/${id}/retire`, {});
  }
}
