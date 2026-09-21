import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AiPerformanceReport,
  CampaignPerformanceReport,
  HumanAgentPerformanceReport,
  LeadFunnelReport,
} from '../models/report.model';

/** The tenant's reports. Each takes `days`, the window ending now (API clamps it to 1-365). */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly baseUrl = `${environment.apiBaseUrl}/reports`;

  constructor(private readonly http: HttpClient) {}

  campaignPerformance(days: number): Observable<CampaignPerformanceReport> {
    return this.http.get<CampaignPerformanceReport>(`${this.baseUrl}/campaign-performance`, { params: { days } });
  }

  leadFunnel(days: number): Observable<LeadFunnelReport> {
    return this.http.get<LeadFunnelReport>(`${this.baseUrl}/lead-funnel`, { params: { days } });
  }

  agentPerformance(days: number): Observable<HumanAgentPerformanceReport> {
    return this.http.get<HumanAgentPerformanceReport>(`${this.baseUrl}/agent-performance`, { params: { days } });
  }

  aiPerformance(days: number): Observable<AiPerformanceReport> {
    return this.http.get<AiPerformanceReport>(`${this.baseUrl}/ai-performance`, { params: { days } });
  }
}
