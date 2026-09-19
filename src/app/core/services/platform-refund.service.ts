import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Payment,
  QuotaBalance,
  QuotaLedgerEntry,
  QuotaLedgerQuery,
  QuotaType,
  RefundRequest,
  RefundStatus,
} from '../models/billing.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

export interface PlatformRefundQuery extends PagedQuery {
  status?: RefundStatus;
  tenantId?: string;
}

export interface AdjustQuotaRequest {
  quotaType: QuotaType;
  /** Positive adds a grant, negative removes from what the tenant has left. */
  unitsDelta: number;
  reason: string;
  validForDays?: number | null;
}

/** PlatformSuperAdmin-only: refund requests and a tenant's prepaid quota. Nothing here approves itself —
 * every refund is a person's decision. */
@Injectable({ providedIn: 'root' })
export class PlatformRefundService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformRefundQuery): Observable<PagedResult<RefundRequest>> {
    return this.http.get<PagedResult<RefundRequest>>(`${this.baseUrl}/refund-requests`, {
      params: {
        ...toPagedParams(query),
        // != null, not truthy: RefundStatus.Requested is 0.
        ...(query.status != null ? { Status: String(query.status) } : {}),
        ...(query.tenantId ? { TenantId: query.tenantId } : {}),
      },
    });
  }

  approve(id: string, note: string, approvedAmountCents?: number | null): Observable<RefundRequest> {
    return this.http.post<RefundRequest>(`${this.baseUrl}/refund-requests/${id}/approve`, { note, approvedAmountCents });
  }

  reject(id: string, note: string): Observable<RefundRequest> {
    return this.http.post<RefundRequest>(`${this.baseUrl}/refund-requests/${id}/reject`, { note });
  }

  /** Refunds one payment on the operator's own initiative — outside the tenant switch and the tenant-facing
   * time and usage limits, but never for money that isn't there. */
  refundDirect(tenantId: string, paymentId: string, note: string): Observable<RefundRequest> {
    return this.http.post<RefundRequest>(`${this.baseUrl}/tenants/${tenantId}/payments/${paymentId}/refund`, { note });
  }

  setRefundRequestsEnabled(tenantId: string, enabled: boolean): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/tenants/${tenantId}/refund-requests-enabled`, { enabled });
  }

  getTenantPayments(tenantId: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.baseUrl}/tenants/${tenantId}/payments`);
  }

  getTenantQuota(tenantId: string): Observable<QuotaBalance[]> {
    return this.http.get<QuotaBalance[]>(`${this.baseUrl}/tenants/${tenantId}/quota`);
  }

  getTenantLedger(tenantId: string, query: QuotaLedgerQuery): Observable<PagedResult<QuotaLedgerEntry>> {
    return this.http.get<PagedResult<QuotaLedgerEntry>>(`${this.baseUrl}/tenants/${tenantId}/quota/ledger`, {
      params: {
        ...toPagedParams(query),
        ...(query.quotaType != null ? { QuotaType: String(query.quotaType) } : {}),
      },
    });
  }

  adjustQuota(tenantId: string, request: AdjustQuotaRequest): Observable<QuotaBalance[]> {
    return this.http.post<QuotaBalance[]>(`${this.baseUrl}/tenants/${tenantId}/quota/adjust`, request);
  }
}
