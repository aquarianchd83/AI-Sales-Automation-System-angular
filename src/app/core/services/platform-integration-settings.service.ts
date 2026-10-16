import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DeliveryTestResult,
  PlatformIntegrationSettings,
  SendIntegrationTestRequest,
  UpdatePlatformIntegrationSettingsRequest,
} from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformIntegrationSettingsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/integration-settings`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<PlatformIntegrationSettings> {
    return this.http.get<PlatformIntegrationSettings>(this.baseUrl);
  }

  /** Takes effect on the next request, no restart. API keys: null keeps, '' clears, text replaces. */
  save(request: UpdatePlatformIntegrationSettingsRequest): Observable<PlatformIntegrationSettings> {
    return this.http.put<PlatformIntegrationSettings>(this.baseUrl, request);
  }

  /** Sends one real SMS through the third-party API in the request, saved or not. */
  testConsentSms(request: SendIntegrationTestRequest): Observable<DeliveryTestResult> {
    return this.http.post<DeliveryTestResult>(`${this.baseUrl}/test-consent-sms`, request);
  }

  /** Checks one number against the third-party DND API in the request, saved or not. */
  testDndCheck(request: SendIntegrationTestRequest): Observable<DeliveryTestResult> {
    return this.http.post<DeliveryTestResult>(`${this.baseUrl}/test-dnd-check`, request);
  }
}
