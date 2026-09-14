import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Payment, Plan, RegionOption, Subscription } from '../models/billing.model';

/**
 * Tenant-facing billing (SaaS conversion Phase D). Payments are simulated for now — see
 * IBillingService's own doc comment on the backend (Stripe pulled out for an India-first launch,
 * Razorpay not wired in yet) — so choosePlan() switches the tenant's plan directly instead of
 * redirecting anywhere; there's no external checkout/portal page this service hands off to.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly baseUrl = `${environment.apiBaseUrl}/billing`;

  constructor(private readonly http: HttpClient) {}

  /** The public plan catalog — safe to call unauthenticated. */
  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.baseUrl}/plans`);
  }

  /** The public country/currency catalog — safe to call unauthenticated, backs the signup page's
   * country picker. */
  getRegions(): Observable<RegionOption[]> {
    return this.http.get<RegionOption[]>(`${this.baseUrl}/regions`);
  }

  /** Null if the tenant has no Subscription row at all yet (still on its signup trial). */
  getSubscription(): Observable<Subscription | null> {
    return this.http.get<Subscription | null>(`${this.baseUrl}/subscription`);
  }

  /** Simulates a successful payment for this plan and switches the tenant to it immediately —
   * see IBillingService.ChoosePlanAsync's own doc comment on the backend. */
  choosePlan(planId: string): Observable<Subscription> {
    return this.http.post<Subscription>(`${this.baseUrl}/plans/${planId}/choose`, {});
  }

  /** The calling tenant's payment history, most recent first. */
  getPaymentHistory(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.baseUrl}/payments`);
  }
}
