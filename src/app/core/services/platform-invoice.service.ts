import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import { PlatformInvoiceDetail, PlatformInvoiceListItem, PlatformInvoiceQuery } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformInvoiceService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/invoices`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformInvoiceQuery): Observable<PagedResult<PlatformInvoiceListItem>> {
    return this.http.get<PagedResult<PlatformInvoiceListItem>>(this.baseUrl, {
      params: {
        ...toPagedParams(query),
        // != null rather than a truthy check - InvoiceStatus.Due is 0, which is falsy.
        ...(query.status != null ? { Status: String(query.status) } : {}),
        ...(query.tenantId ? { TenantId: query.tenantId } : {}),
      },
    });
  }

  getById(id: string): Observable<PlatformInvoiceDetail> {
    return this.http.get<PlatformInvoiceDetail>(`${this.baseUrl}/${id}`);
  }

  markPaid(id: string): Observable<PlatformInvoiceDetail> {
    return this.http.post<PlatformInvoiceDetail>(`${this.baseUrl}/${id}/mark-paid`, {});
  }
}
