import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformDashboard } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformDashboardService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/dashboard`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<PlatformDashboard> {
    return this.http.get<PlatformDashboard>(this.baseUrl);
  }
}
