import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import {
  CreateCreditPackRequest,
  CreatePlanRequest,
  PlatformCreditPack,
  PlatformPlan,
  PlatformSubscriptionListItem,
  PlatformSubscriptionQuery,
  UpdateCreditPackRequest,
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

  getCreditPacks(): Observable<PlatformCreditPack[]> {
    return this.http.get<PlatformCreditPack[]>(`${this.baseUrl}/credit-packs`);
  }

  createCreditPack(request: CreateCreditPackRequest): Observable<PlatformCreditPack> {
    return this.http.post<PlatformCreditPack>(`${this.baseUrl}/credit-packs`, request);
  }

  updateCreditPack(id: string, request: UpdateCreditPackRequest): Observable<PlatformCreditPack> {
    return this.http.put<PlatformCreditPack>(`${this.baseUrl}/credit-packs/${id}`, request);
  }

  /** Retires the pack (isActive = false) - purchases already made keep their credits. */
  deleteCreditPack(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/credit-packs/${id}`);
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
