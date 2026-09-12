import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import {
  PlatformGlobalJob,
  PlatformJobQuery,
  PlatformJobTriggerResult,
  PlatformTenantJob,
  PlatformTenantJobs,
  TenantJobDefinition,
  TenantJobReconcileSummary,
  UpdateTenantJobScheduleRequest,
} from '../models/platform.model';

/**
 * PlatformSuperAdmin-only view of every tenant's Hangfire recurring jobs (`/platform/jobs`).
 *
 * There is deliberately no tenant-facing counterpart: background job scheduling is platform
 * operations, the same call already made for tenant WhatsApp/AI credentials.
 */
@Injectable({ providedIn: 'root' })
export class PlatformJobService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/jobs`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformJobQuery): Observable<PagedResult<PlatformTenantJob>> {
    return this.http.get<PagedResult<PlatformTenantJob>>(this.baseUrl, {
      params: toJobParams(query),
    });
  }

  /** The server's job catalog — drives the job-type filter and the schedule dialog's default cron. */
  getCatalog(): Observable<TenantJobDefinition[]> {
    return this.http.get<TenantJobDefinition[]>(`${this.baseUrl}/catalog`);
  }

  /** The recurring jobs that are not per-tenant. Read-only. */
  getPlatformJobs(): Observable<PlatformGlobalJob[]> {
    return this.http.get<PlatformGlobalJob[]>(`${this.baseUrl}/platform`);
  }

  getForTenant(tenantId: string): Observable<PlatformTenantJobs> {
    return this.http.get<PlatformTenantJobs>(`${this.baseUrl}/tenants/${tenantId}`);
  }

  /** Changes one tenant's cron for one job, or pauses/resumes it. Takes effect immediately — the
   * server rebuilds the Hangfire registration as part of the same request. */
  updateSchedule(
    tenantId: string,
    jobType: string,
    request: UpdateTenantJobScheduleRequest
  ): Observable<PlatformTenantJob> {
    return this.http.put<PlatformTenantJob>(`${this.baseUrl}/tenants/${tenantId}/${jobType}`, request);
  }

  /** Runs one tenant's copy of a job once, now, without changing its schedule. The server refuses
   * (409) for a paused job or an ineligible tenant. */
  trigger(tenantId: string, jobType: string): Observable<PlatformJobTriggerResult> {
    return this.http.post<PlatformJobTriggerResult>(
      `${this.baseUrl}/tenants/${tenantId}/${jobType}/trigger`,
      {}
    );
  }

  /** Rebuilds every tenant's registrations from the schedule table — the same pass that runs at
   * startup and once daily. This on-demand call is the way a reconcile is normally meant to happen;
   * the scheduled pass is only a backstop for when nobody is looking. */
  reconcile(): Observable<TenantJobReconcileSummary> {
    return this.http.post<TenantJobReconcileSummary>(`${this.baseUrl}/reconcile`, {});
  }
}

/**
 * Maps a PlatformJobQuery onto the PascalCase names the API binds. Not `toPagedParams`, which only
 * knows Page/PageSize/Search — this endpoint takes four filters on top of those. Booleans are
 * omitted when undefined rather than sent as "false", since the API treats an absent filter and an
 * explicit false as different things (all jobs vs. only paused ones).
 */
function toJobParams(query: PlatformJobQuery): HttpParams {
  let params = new HttpParams();
  if (query.page != null) {
    params = params.set('Page', String(query.page));
  }
  if (query.pageSize != null) {
    params = params.set('PageSize', String(query.pageSize));
  }
  if (query.search) {
    params = params.set('Search', query.search);
  }
  if (query.tenantId) {
    params = params.set('TenantId', query.tenantId);
  }
  if (query.jobType) {
    params = params.set('JobType', query.jobType);
  }
  if (query.isEnabled != null) {
    params = params.set('IsEnabled', String(query.isEnabled));
  }
  if (query.failingOnly != null) {
    params = params.set('FailingOnly', String(query.failingOnly));
  }
  return params;
}
