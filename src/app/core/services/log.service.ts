import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LogEntry, LogQuery } from '../models/log.model';
import { PagedResult } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class LogService {
  private readonly baseUrl = `${environment.apiBaseUrl}/logs`;

  constructor(private readonly http: HttpClient) {}

  /** date omitted defaults to today (IST) server-side. SuperAdmin/Admin only — the API 403s otherwise. */
  getPaged(query: LogQuery): Observable<PagedResult<LogEntry>> {
    const params: Record<string, string> = {};
    if (query.date) {
      params['Date'] = query.date;
    }
    if (query.level) {
      params['Level'] = query.level;
    }
    if (query.module) {
      params['Module'] = query.module;
    }
    if (query.method) {
      params['Method'] = query.method;
    }
    if (query.page != null) {
      params['Page'] = String(query.page);
    }
    if (query.pageSize != null) {
      params['PageSize'] = String(query.pageSize);
    }
    if (query.search) {
      params['Search'] = query.search;
    }
    return this.http.get<PagedResult<LogEntry>>(this.baseUrl, { params });
  }

  /** Calendar dates ("yyyy-MM-dd") that have at least one log file, newest first — drives the date filter. */
  getAvailableDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/dates`);
  }

  /** Distinct Module values present in the given date's log file (omit for today, IST) — drives the module filter. */
  getAvailableModules(date?: string): Observable<string[]> {
    const params: Record<string, string> = date ? { date } : {};
    return this.http.get<string[]>(`${this.baseUrl}/modules`, { params });
  }
}
