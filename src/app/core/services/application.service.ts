import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ApplicationExecution,
  ApplicationSetup,
  AvailablePlan,
  PlanApplication,
  SaveSetupRequest,
  SaveSetupResult,
  SetupAuditEntry,
} from '../models/application-setup.model';
import { PagedResult, toPagedParams } from '../models/paged-result.model';

/** A tenant's plan-driven applications: pick a plan, set it up, run it. */
@Injectable({ providedIn: 'root' })
export class ApplicationService {
  private readonly baseUrl = `${environment.apiBaseUrl}/applications`;

  constructor(private readonly http: HttpClient) {}

  /** Plans an application can be started on, each with its current setup version. */
  getPlans(): Observable<AvailablePlan[]> {
    return this.http.get<AvailablePlan[]>(`${this.baseUrl}/plans`);
  }

  getAll(): Observable<PlanApplication[]> {
    return this.http.get<PlanApplication[]>(this.baseUrl);
  }

  get(id: string): Observable<PlanApplication> {
    return this.http.get<PlanApplication>(`${this.baseUrl}/${id}`);
  }

  create(planId: string, name?: string | null): Observable<PlanApplication> {
    return this.http.post<PlanApplication>(this.baseUrl, { planId, name: name || null });
  }

  /** The wizard payload: the plan version's questions, the answers so far and how complete they are. */
  getSetup(id: string): Observable<ApplicationSetup> {
    return this.http.get<ApplicationSetup>(`${this.baseUrl}/${id}/setup`);
  }

  /** Save & Continue / Save & Exit (`complete: false`), or confirm the setup (`complete: true`). */
  saveSetup(id: string, request: SaveSetupRequest): Observable<SaveSetupResult> {
    return this.http.put<SaveSetupResult>(`${this.baseUrl}/${id}/setup`, request);
  }

  changePlan(id: string, planId: string, reason?: string | null): Observable<ApplicationSetup> {
    return this.http.post<ApplicationSetup>(`${this.baseUrl}/${id}/change-plan`, { planId, reason: reason || null });
  }

  /** Moves the application to the newest published version of its plan - never done implicitly. */
  migrate(id: string): Observable<ApplicationSetup> {
    return this.http.post<ApplicationSetup>(`${this.baseUrl}/${id}/migrate`, {});
  }

  /** Runs the application. Answers 409 (with `missing`) while the setup is incomplete. */
  execute(id: string): Observable<ApplicationExecution> {
    return this.http.post<ApplicationExecution>(`${this.baseUrl}/${id}/execute`, {});
  }

  getExecutions(id: string): Observable<ApplicationExecution[]> {
    return this.http.get<ApplicationExecution[]>(`${this.baseUrl}/${id}/executions`);
  }

  getAudit(id: string, page = 1, pageSize = 20): Observable<PagedResult<SetupAuditEntry>> {
    return this.http.get<PagedResult<SetupAuditEntry>>(`${this.baseUrl}/${id}/audit`, { params: toPagedParams({ page, pageSize }) });
  }
}
