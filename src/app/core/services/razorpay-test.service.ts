import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateRazorpayOrderRequest,
  RazorpayCheckResult,
  RazorpayCheckout,
  RazorpayOrder,
  RazorpaySettings,
  RazorpaySuccessResponse,
  RazorpayVerifyResult,
  RazorpayWebhookEvent,
  UpdateRazorpaySettingsRequest,
} from '../models/razorpay.model';

/** The platform's Razorpay test endpoints (PlatformSuperAdmin only). Not connected to tenant billing. */
@Injectable({ providedIn: 'root' })
export class RazorpayTestService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/razorpay`;

  constructor(private readonly http: HttpClient) {}

  getSettings(): Observable<RazorpaySettings> {
    return this.http.get<RazorpaySettings>(`${this.baseUrl}/settings`);
  }

  saveSettings(request: UpdateRazorpaySettingsRequest): Observable<RazorpaySettings> {
    return this.http.put<RazorpaySettings>(`${this.baseUrl}/settings`, request);
  }

  /** Checks a key pair against Razorpay, saved or not. A null secret tests the stored one. */
  testKeys(keyId: string, keySecret: string | null): Observable<RazorpayCheckResult> {
    return this.http.post<RazorpayCheckResult>(`${this.baseUrl}/settings/test`, { keyId, keySecret });
  }

  createOrder(request: CreateRazorpayOrderRequest): Observable<RazorpayCheckout> {
    return this.http.post<RazorpayCheckout>(`${this.baseUrl}/orders`, request);
  }

  /** Hands Checkout's response to the server, which decides whether the payment is real. */
  verify(id: string, response: RazorpaySuccessResponse): Observable<RazorpayVerifyResult> {
    return this.http.post<RazorpayVerifyResult>(`${this.baseUrl}/orders/${id}/verify`, {
      razorpayOrderId: response.razorpay_order_id,
      razorpayPaymentId: response.razorpay_payment_id,
      razorpaySignature: response.razorpay_signature,
    });
  }

  reportFailure(id: string, failure: { paymentId: string | null; code: string | null; description: string | null; reason: string | null }): Observable<RazorpayOrder> {
    return this.http.post<RazorpayOrder>(`${this.baseUrl}/orders/${id}/failed`, failure);
  }

  /** amount in rupees; null refunds what is left. */
  refund(id: string, amount: number | null): Observable<RazorpayOrder> {
    return this.http.post<RazorpayOrder>(`${this.baseUrl}/orders/${id}/refund`, { amount });
  }

  getOrders(): Observable<RazorpayOrder[]> {
    return this.http.get<RazorpayOrder[]>(`${this.baseUrl}/orders`);
  }

  getWebhookEvents(): Observable<RazorpayWebhookEvent[]> {
    return this.http.get<RazorpayWebhookEvent[]>(`${this.baseUrl}/webhook-events`);
  }
}
