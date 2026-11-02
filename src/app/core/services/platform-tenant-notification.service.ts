import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import { PlatformTenantNotification, PlatformTenantNotificationQuery } from '../models/platform.model';

/** The notifications tenants were sent, by mode (in-app, email, WhatsApp) and delivery status. */
@Injectable({ providedIn: 'root' })
export class PlatformTenantNotificationService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/tenant-notifications`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformTenantNotificationQuery): Observable<PagedResult<PlatformTenantNotification>> {
    return this.http.get<PagedResult<PlatformTenantNotification>>(this.baseUrl, {
      params: {
        ...toPagedParams(query),
        ...(query.channel ? { Channel: query.channel } : {}),
        ...(query.status ? { Status: query.status } : {}),
        ...(query.tenantId ? { TenantId: query.tenantId } : {}),
        ...(query.kind ? { Kind: query.kind } : {}),
      },
    });
  }

  /** The names of every kind of notice, for the Type filter. */
  getKinds(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/kinds`);
  }
}
