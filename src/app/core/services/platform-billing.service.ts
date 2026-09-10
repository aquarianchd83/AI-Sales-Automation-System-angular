import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import {
  PlatformPlan,
  PlatformSubscriptionListItem,
  PlatformSubscriptionQuery,
} from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformBillingService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/billing`;

  constructor(private readonly http: HttpClient) {}

  getPlans(): Observable<PlatformPlan[]> {
    return this.http.get<PlatformPlan[]>(`${this.baseUrl}/plans`);
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
