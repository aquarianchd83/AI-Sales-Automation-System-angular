import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';
import {
  RechargeCheckout,
  RechargeOptions,
  RechargeQuote,
  RechargeTransaction,
  RechargeVerifyResult,
  VerifyRechargeRequest,
} from '../models/wallet-recharge.model';

/**
 * The tenant's wallet top-up API. The tenant is identified by the signed-in token and the price by the server: nothing here sends a tenant id, and
 * the wallet is only ever credited by the server once it has verified the payment - so these calls report outcomes, they never grant anything.
 */
@Injectable({ providedIn: 'root' })
export class WalletRechargeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/wallet`;

  constructor(private readonly http: HttpClient) {}

  getOptions(): Observable<RechargeOptions> {
    return this.http.get<RechargeOptions>(`${this.baseUrl}/recharge/options`);
  }

  /** The server's price for an amount: tax on top, total payable, credits bought. Creates nothing. */
  getQuote(amount: number): Observable<RechargeQuote> {
    return this.http.get<RechargeQuote>(`${this.baseUrl}/recharge/quote`, { params: { amount } });
  }

  getBalance(): Observable<{ balance: number; unit: string }> {
    return this.http.get<{ balance: number; unit: string }>(`${this.baseUrl}/balance`);
  }

  createOrder(amount: number): Observable<RechargeCheckout> {
    return this.http.post<RechargeCheckout>(`${this.baseUrl}/recharge/create-order`, { amount, currency: 'INR' });
  }

  /** A Razorpay order for one credit pack - the pack's price plus tax, for the pack's credits, all decided by the server. */
  createPackOrder(packId: string): Observable<RechargeCheckout> {
    return this.http.post<RechargeCheckout>(`${this.baseUrl}/recharge/credit-packs/${encodeURIComponent(packId)}/create-order`, {});
  }

  verifyPayment(request: VerifyRechargeRequest): Observable<RechargeVerifyResult> {
    return this.http.post<RechargeVerifyResult>(`${this.baseUrl}/recharge/verify-payment`, request);
  }

  getStatus(transactionId: string): Observable<RechargeTransaction> {
    return this.http.get<RechargeTransaction>(`${this.baseUrl}/recharge/payment-status/${encodeURIComponent(transactionId)}`);
  }

  getHistory(query: PagedQuery): Observable<PagedResult<RechargeTransaction>> {
    return this.http.get<PagedResult<RechargeTransaction>>(`${this.baseUrl}/recharge/history`, { params: toPagedParams(query) });
  }
}
