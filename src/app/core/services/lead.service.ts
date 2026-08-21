import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AddLeadActivityRequest,
  AssignLeadRequest,
  Lead,
  LeadActivity,
  UpdateLeadRequest,
} from '../models/lead.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly baseUrl = `${environment.apiBaseUrl}/leads`;

  constructor(private readonly http: HttpClient) {}

  /** stage/score filter to one LeadStage/LeadScoreBand value each (e.g. "Qualifying", "Hot"). */
  getPaged(query: PagedQuery, stage?: string, score?: string): Observable<PagedResult<Lead>> {
    const params = {
      ...toPagedParams(query),
      ...(stage ? { stage } : {}),
      ...(score ? { score } : {}),
    };
    return this.http.get<PagedResult<Lead>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<Lead> {
    return this.http.get<Lead>(`${this.baseUrl}/${id}`);
  }

  /** A manual agent correction to stage/budget/interest/purchaseTimeline. */
  update(id: string, request: UpdateLeadRequest): Observable<Lead> {
    return this.http.put<Lead>(`${this.baseUrl}/${id}`, request);
  }

  assign(id: string, request: AssignLeadRequest): Observable<Lead> {
    return this.http.put<Lead>(`${this.baseUrl}/${id}/assign`, request);
  }

  addActivity(id: string, request: AddLeadActivityRequest): Observable<LeadActivity> {
    return this.http.post<LeadActivity>(`${this.baseUrl}/${id}/activities`, request);
  }

  /** The timeline behind this lead's current stage/score/budget/interest/timeline — newest first. */
  getActivities(id: string, query: PagedQuery): Observable<PagedResult<LeadActivity>> {
    return this.http.get<PagedResult<LeadActivity>>(`${this.baseUrl}/${id}/activities`, {
      params: toPagedParams(query),
    });
  }
}
