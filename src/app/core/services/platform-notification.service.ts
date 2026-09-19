import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformNotification } from '../models/platform.model';

/** PlatformSuperAdmin's alert inbox (`/platform/notifications`) — shared, so acknowledging clears it for every operator. */
@Injectable({ providedIn: 'root' })
export class PlatformNotificationService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/notifications`;

  constructor(private readonly http: HttpClient) {}

  getRecent(): Observable<PlatformNotification[]> {
    return this.http.get<PlatformNotification[]>(this.baseUrl);
  }

  acknowledge(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/acknowledge`, {});
  }

  acknowledgeAll(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/acknowledge-all`, {});
  }
}
