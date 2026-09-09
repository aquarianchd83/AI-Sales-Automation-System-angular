import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  BillingSessionUrl,
  CreateBillingPortalSessionRequest,
  CreateCheckoutSessionRequest,
  Plan,
  Subscription,
} from '../models/billing.model';

/**
 * Tenant-facing billing (SaaS conversion Phase D). Stripe's own Checkout and Customer Portal are
 * Stripe-hosted pages this panel only ever redirects the browser to (see BillingComponent) — it
 * never renders either itself, and never talks to Stripe directly.
 */
@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly baseUrl = `${environment.apiBaseUrl}/billing`;

  constructor(private readonly http: HttpClient) {}

  /** The public plan catalog — safe to call unauthenticated. */
  getPlans(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.baseUrl}/plans`);
  }

  /** Null if the tenant has never completed Checkout (still on its signup trial). */
  getSubscription(): Observable<Subscription | null> {
    return this.http.get<Subscription | null>(`${this.baseUrl}/subscription`);
  }

  createCheckoutSession(request: CreateCheckoutSessionRequest): Observable<BillingSessionUrl> {
    return this.http.post<BillingSessionUrl>(`${this.baseUrl}/checkout`, request);
  }

  createBillingPortalSession(request: CreateBillingPortalSessionRequest): Observable<BillingSessionUrl> {
    return this.http.post<BillingSessionUrl>(`${this.baseUrl}/portal`, request);
  }
}
