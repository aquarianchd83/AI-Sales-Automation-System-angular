import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Campaign,
  CampaignProgress,
  CreateCampaignRequest,
  RunJobsResult,
  SetCampaignAudienceRequest,
  SetCampaignAudienceResult,
  UpdateCampaignRequest,
  UpsertCampaignStepRequest,
} from '../models/campaign.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class CampaignService {
  private readonly baseUrl = `${environment.apiBaseUrl}/campaigns`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PagedQuery): Observable<PagedResult<Campaign>> {
    return this.http.get<PagedResult<Campaign>>(this.baseUrl, {
      params: toPagedParams(query),
    });
  }

  getById(id: string): Observable<Campaign> {
    return this.http.get<Campaign>(`${this.baseUrl}/${id}`);
  }

  /** Allowed only while the campaign is Draft. */
  create(request: CreateCampaignRequest): Observable<Campaign> {
    return this.http.post<Campaign>(this.baseUrl, request);
  }

  /** Allowed only while the campaign is Draft. */
  update(id: string, request: UpdateCampaignRequest): Observable<Campaign> {
    return this.http.put<Campaign>(`${this.baseUrl}/${id}`, request);
  }

  /** Allowed only while the campaign is Draft. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Adds the step at the request's StepType position, or replaces it if one already exists
   * there. Allowed only while the campaign is Draft or Paused.
   */
  upsertStep(campaignId: string, request: UpsertCampaignStepRequest): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.baseUrl}/${campaignId}/steps`, request);
  }

  /** Allowed only while the campaign is Draft or Paused. */
  removeStep(campaignId: string, stepType: string): Observable<Campaign> {
    return this.http.delete<Campaign>(`${this.baseUrl}/${campaignId}/steps/${stepType}`);
  }

  /**
   * Adds customers matching any given tag name or id to the campaign. Additive only — there is
   * no endpoint to list or remove a campaign's audience once attached. Blocked once the
   * campaign is Stopped or Completed.
   */
  setAudience(
    campaignId: string,
    request: SetCampaignAudienceRequest
  ): Observable<SetCampaignAudienceResult> {
    return this.http.post<SetCampaignAudienceResult>(
      `${this.baseUrl}/${campaignId}/audience`,
      request
    );
  }

  /**
   * Allowed only from Draft. Requires an active Initial step where every active step has its
   * media count within the configured range and an Approved, active template assigned — the
   * API 409s with specifics otherwise.
   */
  start(campaignId: string): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.baseUrl}/${campaignId}/start`, null);
  }

  /** Allowed only from Running or Scheduled. */
  pause(campaignId: string): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.baseUrl}/${campaignId}/pause`, null);
  }

  /** Allowed only from Paused. Re-runs the same sendability check as start(). */
  resume(campaignId: string): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.baseUrl}/${campaignId}/resume`, null);
  }

  /**
   * Allowed from anything except Stopped or Completed. Every customer awaiting a follow-up is
   * marked Completed so a paused-then-stopped campaign cannot resume sending later.
   */
  stop(campaignId: string): Observable<Campaign> {
    return this.http.post<Campaign>(`${this.baseUrl}/${campaignId}/stop`, null);
  }

  getProgress(campaignId: string): Observable<CampaignProgress> {
    return this.http.get<CampaignProgress>(`${this.baseUrl}/${campaignId}/progress`);
  }

  /**
   * Runs the send pipeline (initial sends, follow-ups, retries) immediately across every
   * eligible campaign, rather than waiting for the next scheduled tick. SuperAdmin only —
   * the API 403s for anyone else.
   */
  runJobsNow(): Observable<RunJobsResult> {
    return this.http.post<RunJobsResult>(`${this.baseUrl}/ops/run-jobs`, null);
  }
}
