import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DeliveryTestResult } from '../models/platform.model';
import { PlatformWhatsAppSettings, UpdatePlatformWhatsAppSettingsRequest } from '../models/platform-whatsapp.model';

@Injectable({ providedIn: 'root' })
export class PlatformWhatsAppSettingsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/whatsapp-settings`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<PlatformWhatsAppSettings> {
    return this.http.get<PlatformWhatsAppSettings>(this.baseUrl);
  }

  /** Takes effect on the next request, no restart. accessToken: null keeps, '' clears, text replaces. */
  save(request: UpdatePlatformWhatsAppSettingsRequest): Observable<PlatformWhatsAppSettings> {
    return this.http.put<PlatformWhatsAppSettings>(this.baseUrl, request);
  }

  /** Asks Meta about the SAVED number, token and Business Account id without sending any message. Always answers 200. */
  verify(): Observable<DeliveryTestResult> {
    return this.http.post<DeliveryTestResult>(`${this.baseUrl}/verify`, {});
  }

  /** Sends Meta's sample template from the SAVED number. Always answers 200; the result says whether it worked. */
  test(to: string): Observable<DeliveryTestResult> {
    return this.http.post<DeliveryTestResult>(`${this.baseUrl}/test`, { to });
  }
}
