import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import {
  CreateCreditPackRequest,
  CreditPackCostReport,
  CreditPackCostRequest,
  CreatePlanRequest,
  PlanCostDefaults,
  PlanCostReport,
  PlanCostReportRequest,
  PlatformCreditPack,
  PlatformPlan,
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

  /** The usage assumptions the cost report starts from - real averages where the platform has history. */
  getPlanCostDefaults(): Observable<PlanCostDefaults> {
    return this.http.get<PlanCostDefaults>(`${this.baseUrl}/plan-cost-defaults`);
  }

  /** The consolidated cost-and-margin report for a plan being designed. Nothing is saved. */
  buildPlanCostReport(request: PlanCostReportRequest): Observable<PlanCostReport> {
    return this.http.post<PlanCostReport>(`${this.baseUrl}/plan-cost-report`, request);
  }

  /** What a credit pack costs to serve and the price that leaves the wanted margin, from the Configuration charges. Nothing is saved. */
  buildCreditPackCost(request: CreditPackCostRequest): Observable<CreditPackCostReport> {
    return this.http.post<CreditPackCostReport>(`${this.baseUrl}/credit-pack-cost`, request);
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
}
