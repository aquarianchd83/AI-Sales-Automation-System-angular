import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ServiceMargins, UpdateServiceMarginsRequest } from '../models/service-margin.model';

/** The Service margins screen's API: what each service costs the platform, what tenants are charged for it, and the margin. */
@Injectable({ providedIn: 'root' })
export class PlatformServiceMarginService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/service-margins`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<ServiceMargins> {
    return this.http.get<ServiceMargins>(this.baseUrl);
  }

  update(request: UpdateServiceMarginsRequest): Observable<ServiceMargins> {
    return this.http.put<ServiceMargins>(this.baseUrl, request);
  }
}
