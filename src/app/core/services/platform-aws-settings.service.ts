import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AwsConnectionTestResult, PlatformAwsSettings, UpdatePlatformAwsSettingsRequest } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformAwsSettingsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/aws-settings`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<PlatformAwsSettings> {
    return this.http.get<PlatformAwsSettings>(this.baseUrl);
  }

  /** Takes effect on the next request, no restart. Credentials: null keeps, '' clears, text replaces. */
  save(request: UpdatePlatformAwsSettingsRequest): Observable<PlatformAwsSettings> {
    return this.http.put<PlatformAwsSettings>(this.baseUrl, request);
  }

  /** Tries the given settings against AWS WITHOUT saving them; null credentials test with the stored ones. */
  testConnection(request: UpdatePlatformAwsSettingsRequest): Observable<AwsConnectionTestResult> {
    return this.http.post<AwsConnectionTestResult>(`${this.baseUrl}/test-connection`, request);
  }
}
