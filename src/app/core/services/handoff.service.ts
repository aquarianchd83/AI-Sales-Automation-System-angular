import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Handoff, ResolveHandoffRequest } from '../models/handoff.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class HandoffService {
  private readonly baseUrl = `${environment.apiBaseUrl}/handoffs`;

  constructor(private readonly http: HttpClient) {}

  /** status filters to one HandoffStatus value (e.g. "Pending") when given. */
  getPaged(query: PagedQuery, status?: string): Observable<PagedResult<Handoff>> {
    const params = { ...toPagedParams(query), ...(status ? { status } : {}) };
    return this.http.get<PagedResult<Handoff>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<Handoff> {
    return this.http.get<Handoff>(`${this.baseUrl}/${id}`);
  }

  /** Pending -> Assigned, to the caller. Re-claiming an already-Assigned handoff reassigns it
   * rather than failing — the last agent to claim it owns it. */
  claim(id: string): Observable<Handoff> {
    return this.http.post<Handoff>(`${this.baseUrl}/${id}/claim`, null);
  }

  resolve(id: string, request: ResolveHandoffRequest): Observable<Handoff> {
    return this.http.post<Handoff>(`${this.baseUrl}/${id}/resolve`, request);
  }
}
