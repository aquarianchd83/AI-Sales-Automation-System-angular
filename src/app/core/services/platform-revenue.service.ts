import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformRevenueReport } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformRevenueService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/revenue`;

  constructor(private readonly http: HttpClient) {}

  /** from/to are inclusive calendar days as yyyy-MM-dd; omit both for the last twelve months. */
  get(from?: string, to?: string, tenantId?: string): Observable<PlatformRevenueReport> {
    return this.http.get<PlatformRevenueReport>(this.baseUrl, {
      params: { ...(from ? { From: from } : {}), ...(to ? { To: to } : {}), ...(tenantId ? { TenantId: tenantId } : {}) },
    });
  }
}
