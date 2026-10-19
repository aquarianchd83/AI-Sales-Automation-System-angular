import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import {
  AiExecution,
  AiPolicy,
  AiProviderId,
  AiProviderInsight,
  AiProvidersOverview,
  UpdateAiPolicyRequest,
} from '../models/platform.model';

/** What the AI screens add to the provider settings: last Verify, capabilities, the accuracy test, the AI policy and the call log
 * (PlatformSuperAdmin only). Keys, models and On/Off are saved through SettingsService, as before. */
@Injectable({ providedIn: 'root' })
export class PlatformAiProvidersService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/ai-providers`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<AiProvidersOverview> {
    return this.http.get<AiProvidersOverview>(this.baseUrl);
  }

  /** Runs the fixed accuracy test with the provider's configured model and the saved key. */
  benchmark(provider: AiProviderId): Observable<AiProviderInsight> {
    return this.http.post<AiProviderInsight>(`${this.baseUrl}/${provider}/benchmark`, {});
  }

  updatePolicy(request: UpdateAiPolicyRequest): Observable<AiPolicy> {
    return this.http.put<AiPolicy>(`${this.baseUrl}/policy`, request);
  }

  executions(page: number, pageSize: number): Observable<PagedResult<AiExecution>> {
    const params = new HttpParams().set('Page', String(page)).set('PageSize', String(pageSize));
    return this.http.get<PagedResult<AiExecution>>(`${this.baseUrl}/executions`, { params });
  }
}
