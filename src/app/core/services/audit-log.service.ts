import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuditLogEntry, AuditLogQuery } from '../models/audit-log.model';
import { PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly baseUrl = `${environment.apiBaseUrl}/audit-logs`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: AuditLogQuery): Observable<PagedResult<AuditLogEntry>> {
    const params: Record<string, string> = toPagedParams(query);
    // The API binds PascalCase names.
    if (query.entityName) params['EntityName'] = query.entityName;
    if (query.entityId) params['EntityId'] = query.entityId;
    if (query.action) params['Action'] = query.action;
    if (query.performedBy) params['PerformedBy'] = query.performedBy;
    if (query.from) params['From'] = query.from;
    if (query.to) params['To'] = query.to;
    return this.http.get<PagedResult<AuditLogEntry>>(this.baseUrl, { params });
  }
}
