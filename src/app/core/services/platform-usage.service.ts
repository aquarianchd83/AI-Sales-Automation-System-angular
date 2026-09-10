import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';
import { PlatformTenantUsage } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformUsageService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/usage`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PagedQuery): Observable<PagedResult<PlatformTenantUsage>> {
    return this.http.get<PagedResult<PlatformTenantUsage>>(this.baseUrl, {
      params: toPagedParams(query),
    });
  }
}
