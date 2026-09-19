import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import { PlatformPaymentListItem, PlatformPaymentQuery } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformPaymentService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/payments`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformPaymentQuery): Observable<PagedResult<PlatformPaymentListItem>> {
    return this.http.get<PagedResult<PlatformPaymentListItem>>(this.baseUrl, {
      params: {
        ...toPagedParams(query),
        ...(query.kind ? { Kind: query.kind } : {}),
        ...(query.tenantId ? { TenantId: query.tenantId } : {}),
      },
    });
  }
}
