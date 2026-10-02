import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  DeliveryTestResult,
  PlatformDeliverySettings,
  SendDeliveryTestRequest,
  UpdatePlatformDeliverySettingsRequest,
} from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformDeliverySettingsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/delivery-settings`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<PlatformDeliverySettings> {
    return this.http.get<PlatformDeliverySettings>(this.baseUrl);
  }

  /** Takes effect on the next request, no restart. Secrets: null keeps, '' clears, text replaces. */
  save(request: UpdatePlatformDeliverySettingsRequest): Observable<PlatformDeliverySettings> {
    return this.http.put<PlatformDeliverySettings>(this.baseUrl, request);
  }

  /** Sends one real email with the settings in the request, saved or not. */
  testEmail(request: SendDeliveryTestRequest): Observable<DeliveryTestResult> {
    return this.http.post<DeliveryTestResult>(`${this.baseUrl}/test-email`, request);
  }

  /** Sends one real text (with a sample code) with the settings in the request, saved or not. */
  testSms(request: SendDeliveryTestRequest): Observable<DeliveryTestResult> {
    return this.http.post<DeliveryTestResult>(`${this.baseUrl}/test-sms`, request);
  }
}
