import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  LeadFollowUp,
  LeadFollowUpSummary,
  ScheduleLeadFollowUpRequest,
} from '../models/lead-follow-up.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

/** The "follow up later" list: leads who were interested but could not go ahead yet, each with a date to be
 * contacted again. */
@Injectable({ providedIn: 'root' })
export class LeadFollowUpService {
  private readonly followUpsUrl = `${environment.apiBaseUrl}/lead-follow-ups`;
  private readonly leadsUrl = `${environment.apiBaseUrl}/leads`;

  constructor(private readonly http: HttpClient) {}

  /** Scheduled follow-ups, soonest due first. `status` switches to a history view (Sent, Failed, Skipped,
   * Cancelled); `dueWithinDays` narrows Scheduled to what is due within that many days, overdue included. */
  getPaged(query: PagedQuery, status?: string, dueWithinDays?: number): Observable<PagedResult<LeadFollowUp>> {
    const params = {
      ...toPagedParams(query),
      ...(status ? { status } : {}),
      ...(dueWithinDays != null ? { dueWithinDays: String(dueWithinDays) } : {}),
    };
    return this.http.get<PagedResult<LeadFollowUp>>(this.followUpsUrl, { params });
  }

  getSummary(): Observable<LeadFollowUpSummary> {
    return this.http.get<LeadFollowUpSummary>(`${this.followUpsUrl}/summary`);
  }

  /** Every follow-up the lead has had, newest first. */
  getForLead(leadId: string): Observable<LeadFollowUp[]> {
    return this.http.get<LeadFollowUp[]>(`${this.leadsUrl}/${leadId}/follow-ups`);
  }

  /** Parks the lead. Replaces the lead's current Scheduled follow-up, if any. */
  schedule(leadId: string, request: ScheduleLeadFollowUpRequest): Observable<LeadFollowUp> {
    return this.http.post<LeadFollowUp>(`${this.leadsUrl}/${leadId}/follow-ups`, request);
  }

  cancel(id: string): Observable<LeadFollowUp> {
    return this.http.post<LeadFollowUp>(`${this.followUpsUrl}/${id}/cancel`, {});
  }

  /** Sends a Scheduled or Failed follow-up now, outside the daytime window. */
  sendNow(id: string): Observable<LeadFollowUp> {
    return this.http.post<LeadFollowUp>(`${this.followUpsUrl}/${id}/send-now`, {});
  }
}
