import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DeliveryTestResult } from '../models/platform.model';
import {
  PlatformMessageTemplate,
  PlatformTemplateSyncResult,
  UpdatePlatformMessageTemplateRequest,
} from '../models/platform-whatsapp.model';

@Injectable({ providedIn: 'root' })
export class PlatformMessageTemplatesService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/message-templates`;

  constructor(private readonly http: HttpClient) {}

  /** One per kind of notice, in the order they are explained to the admin. */
  getAll(): Observable<PlatformMessageTemplate[]> {
    return this.http.get<PlatformMessageTemplate[]>(this.baseUrl);
  }

  update(id: string, request: UpdatePlatformMessageTemplateRequest): Observable<PlatformMessageTemplate> {
    return this.http.put<PlatformMessageTemplate>(`${this.baseUrl}/${id}`, request);
  }

  restoreDefault(id: string): Observable<PlatformMessageTemplate> {
    return this.http.post<PlatformMessageTemplate>(`${this.baseUrl}/${id}/restore-default`, {});
  }

  /** Pushes new and edited templates to Meta and pulls every template's review status. */
  sync(): Observable<PlatformTemplateSyncResult> {
    return this.http.post<PlatformTemplateSyncResult>(`${this.baseUrl}/sync`, {});
  }

  syncOne(id: string): Observable<PlatformMessageTemplate> {
    return this.http.post<PlatformMessageTemplate>(`${this.baseUrl}/${id}/sync`, {});
  }

  /** Sends the template with sample values. Always answers 200; the result says whether it went. */
  test(id: string, to: string): Observable<DeliveryTestResult> {
    return this.http.post<DeliveryTestResult>(`${this.baseUrl}/${id}/test`, { to });
  }
}
