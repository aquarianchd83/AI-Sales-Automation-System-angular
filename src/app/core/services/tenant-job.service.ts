import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  TenantJob,
  TenantJobTriggerResult,
  TenantJobs,
  UpdateTenantJobScheduleRequest,
} from '../models/tenant-job.model';

/** The calling tenant's own view onto its background jobs — campaign sending and lead discovery only.
 * Admin only, same gate as the lead discovery profile: this is operational/spend control, not something
 * every tenant user should be able to reach. */
@Injectable({ providedIn: 'root' })
export class TenantJobService {
  private readonly baseUrl = `${environment.apiBaseUrl}/jobs`;

  constructor(private readonly http: HttpClient) {}

  getJobs(): Observable<TenantJobs> {
    return this.http.get<TenantJobs>(this.baseUrl);
  }

  /** Takes effect immediately — the Hangfire registration is rebuilt as part of this request. */
  updateSchedule(jobType: string, request: UpdateTenantJobScheduleRequest): Observable<TenantJob> {
    return this.http.put<TenantJob>(`${this.baseUrl}/${jobType}`, request);
  }

  /** Runs this tenant's copy of a job once, now, without changing its schedule. Refused (409) for a
   * disabled job. */
  trigger(jobType: string): Observable<TenantJobTriggerResult> {
    return this.http.post<TenantJobTriggerResult>(`${this.baseUrl}/${jobType}/trigger`, null);
  }
}
