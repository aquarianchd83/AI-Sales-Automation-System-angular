import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AgentPerformanceReport } from '../models/agent-performance.model';

@Injectable({ providedIn: 'root' })
export class AgentPerformanceService {
  private readonly baseUrl = `${environment.apiBaseUrl}/agent-performance`;

  constructor(private readonly http: HttpClient) {}

  /** `days` is the window ending now. The API clamps it at 90. */
  getReport(days: number): Observable<AgentPerformanceReport> {
    return this.http.get<AgentPerformanceReport>(this.baseUrl, { params: { days } });
  }
}
