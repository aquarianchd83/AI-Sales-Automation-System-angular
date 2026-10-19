import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import {
  AiExecution,
  AiPolicy,
  AiProviderCheckResult,
  AiProviderId,
  AiProviderPanel,
  AiProvidersOverview,
  UpdateAiPolicyRequest,
  UpdateAiProviderRequest,
} from '../models/platform.model';

/** The Integrations page's AI provider cards (PlatformSuperAdmin only). */
@Injectable({ providedIn: 'root' })
export class PlatformAiProvidersService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/ai-providers`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<AiProvidersOverview> {
    return this.http.get<AiProvidersOverview>(this.baseUrl);
  }

  update(provider: AiProviderId, request: UpdateAiProviderRequest): Observable<AiProviderPanel> {
    return this.http.put<AiProviderPanel>(`${this.baseUrl}/${provider}`, request);
  }

  /** Checks the saved key, then makes one tiny real request with the configured model. */
  verify(provider: AiProviderId): Observable<AiProviderCheckResult> {
    return this.http.post<AiProviderCheckResult>(`${this.baseUrl}/${provider}/verify`, {});
  }

  /** Runs the fixed accuracy test with the provider's configured model and the saved key. */
  benchmark(provider: AiProviderId): Observable<AiProviderPanel> {
    return this.http.post<AiProviderPanel>(`${this.baseUrl}/${provider}/benchmark`, {});
  }

  updatePolicy(request: UpdateAiPolicyRequest): Observable<AiPolicy> {
    return this.http.put<AiPolicy>(`${this.baseUrl}/policy`, request);
  }

  executions(page: number, pageSize: number): Observable<PagedResult<AiExecution>> {
    const params = new HttpParams().set('Page', String(page)).set('PageSize', String(pageSize));
    return this.http.get<PagedResult<AiExecution>>(`${this.baseUrl}/executions`, { params });
  }
}
