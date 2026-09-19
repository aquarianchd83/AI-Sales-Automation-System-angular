import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  BillingAlertSettings,
  BillingCapabilities,
  CreditPack,
  Payment,
  Plan,
  QuotaBalance,
  QuotaLedgerEntry,
  QuotaLedgerQuery,
  RefundEligibility,
  RefundRequest,
  RegionOption,
  Subscription,
  TenantNotification,
} from '../models/billing.model';
import { PagedResult, toPagedParams } from '../models/paged-result.model';

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

  /** Prepaid balance per quota type, with the live grants (included quota, credits) behind each. */
  getQuota(): Observable<QuotaBalance[]> {
    return this.http.get<QuotaBalance[]>(`${this.baseUrl}/quota`);
  }

  /** The tenant's own quota ledger, newest first. */
  getLedger(query: QuotaLedgerQuery): Observable<PagedResult<QuotaLedgerEntry>> {
    return this.http.get<PagedResult<QuotaLedgerEntry>>(`${this.baseUrl}/quota/ledger`, {
      params: {
        ...toPagedParams(query),
        // != null, not truthy: QuotaType.WhatsAppMessages is 0.
        ...(query.quotaType != null ? { QuotaType: String(query.quotaType) } : {}),
      },
    });
  }

  getCreditPacks(): Observable<CreditPack[]> {
    return this.http.get<CreditPack[]>(`${this.baseUrl}/credit-packs`);
  }

  /** Simulated payment for one pack; the units are usable immediately and valid for 12 months. */
  purchaseCreditPack(packId: string): Observable<Payment> {
    return this.http.post<Payment>(`${this.baseUrl}/credit-packs/${packId}/purchase`, {});
  }

  getCapabilities(): Observable<BillingCapabilities> {
    return this.http.get<BillingCapabilities>(`${this.baseUrl}/capabilities`);
  }

  getNotifications(): Observable<TenantNotification[]> {
    return this.http.get<TenantNotification[]>(`${this.baseUrl}/notifications`);
  }

  acknowledgeNotification(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/notifications/${id}/acknowledge`, {});
  }

  getAlertSettings(): Observable<BillingAlertSettings> {
    return this.http.get<BillingAlertSettings>(`${this.baseUrl}/alert-settings`);
  }

  updateAlertSettings(settings: BillingAlertSettings): Observable<BillingAlertSettings> {
    return this.http.put<BillingAlertSettings>(`${this.baseUrl}/alert-settings`, settings);
  }

  /** 403 unless the platform operator has switched refund requests on for this tenant. */
  getRefundEligibility(paymentId: string): Observable<RefundEligibility> {
    return this.http.get<RefundEligibility>(`${this.baseUrl}/payments/${paymentId}/refund-eligibility`);
  }

  getRefundRequests(): Observable<RefundRequest[]> {
    return this.http.get<RefundRequest[]>(`${this.baseUrl}/refund-requests`);
  }

  requestRefund(paymentId: string, reason: string): Observable<RefundRequest> {
    return this.http.post<RefundRequest>(`${this.baseUrl}/refund-requests`, { paymentId, reason });
  }

  cancelRefundRequest(id: string): Observable<RefundRequest> {
    return this.http.post<RefundRequest>(`${this.baseUrl}/refund-requests/${id}/cancel`, {});
  }
}
