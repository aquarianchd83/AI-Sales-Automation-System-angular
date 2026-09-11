import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import {
  CreatePlanRequest,
  PlatformPlan,
  PlatformSubscriptionListItem,
  PlatformSubscriptionQuery,
  UpdatePlanRequest,
} from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformBillingService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/billing`;

  constructor(private readonly http: HttpClient) {}

  getPlans(): Observable<PlatformPlan[]> {
    return this.http.get<PlatformPlan[]>(`${this.baseUrl}/plans`);
  }

  createPlan(request: CreatePlanRequest): Observable<PlatformPlan> {
    return this.http.post<PlatformPlan>(`${this.baseUrl}/plans`, request);
  }

  updatePlan(id: string, request: UpdatePlanRequest): Observable<PlatformPlan> {
    return this.http.put<PlatformPlan>(`${this.baseUrl}/plans/${id}`, request);
  }

  /** Retires the plan (isActive = false) — never a hard delete, see
   * IPlatformBillingService.DeactivatePlanAsync's own doc comment for why. */
  deletePlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/plans/${id}`);
  }

  getSubscriptions(query: PlatformSubscriptionQuery): Observable<PagedResult<PlatformSubscriptionListItem>> {
    return this.http.get<PagedResult<PlatformSubscriptionListItem>>(`${this.baseUrl}/subscriptions`, {
      params: {
        ...toPagedParams(query),
        ...(query.status != null ? { Status: String(query.status) } : {}),
      },
    });
  }
}
