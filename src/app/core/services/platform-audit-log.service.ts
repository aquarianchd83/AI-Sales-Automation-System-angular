import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import { PlatformAuditLogEntry, PlatformAuditLogQuery } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformAuditLogService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/audit-log`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformAuditLogQuery): Observable<PagedResult<PlatformAuditLogEntry>> {
    return this.http.get<PagedResult<PlatformAuditLogEntry>>(this.baseUrl, {
      params: {
        ...toPagedParams(query),
        ...(query.targetTenantId ? { TargetTenantId: query.targetTenantId } : {}),
      },
    });
  }
}
