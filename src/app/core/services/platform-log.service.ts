import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult, toPagedParams } from '../models/paged-result.model';
import { PlatformLogEntry, PlatformLogQuery } from '../models/platform.model';

/** The API's own log file, read through LogsController. PlatformSuperAdmin only — a day's file holds
 * every tenant's lines, so the tenant filter is the only thing narrowing it. */
@Injectable({ providedIn: 'root' })
export class PlatformLogService {
  private readonly baseUrl = `${environment.apiBaseUrl}/logs`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformLogQuery): Observable<PagedResult<PlatformLogEntry>> {
    return this.http.get<PagedResult<PlatformLogEntry>>(this.baseUrl, {
      params: {
        ...toPagedParams(query),
        ...(query.date ? { Date: query.date } : {}),
        // An array is sent as a repeated key (Level=Error&Level=Warning), which the API binds as a list.
        ...(query.levels?.length ? { Level: query.levels } : {}),
        ...(query.module ? { Module: query.module } : {}),
        ...(query.tenantId ? { TenantId: query.tenantId } : {}),
      },
    });
  }

  /** Dates (`YYYY-MM-DD`) that have a log file, newest first. */
  getDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/dates`);
  }

  /** Logging classes present in that date's file (today when omitted). */
  getModules(date?: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/modules`, {
      params: date ? { date } : {},
    });
  }
}
