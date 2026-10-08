import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AiProviderCheck, SettingCategory, UpdateSettingsRequest } from '../models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/settings`;

  constructor(private readonly http: HttpClient) {}

  /** All categories with their items, for the configuration screen's tab list. */
  getAll(): Observable<SettingCategory[]> {
    return this.http.get<SettingCategory[]>(this.baseUrl);
  }

  getCategory(category: string): Observable<SettingCategory> {
    return this.http.get<SettingCategory>(`${this.baseUrl}/${category}`);
  }

  /** `values` should hold only the keys being changed — see UpdateSettingsRequest. */
  update(category: string, values: Record<string, string | null>): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${category}`, {
      values,
    } as UpdateSettingsRequest);
  }

  /** Tries each SAVED AI provider key (or just `provider`'s) against its provider (lists models, spends nothing). Always 200 - each result says whether it worked. */
  verifyAiProviders(provider?: string): Observable<AiProviderCheck[]> {
    return this.http.post<AiProviderCheck[]>(`${this.baseUrl}/ai-providers/verify`, {}, { params: provider ? { provider } : {} });
  }

  /** Tells the API to re-read configuration from its store into the live process. */
  reload(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reload`, {});
  }
}
