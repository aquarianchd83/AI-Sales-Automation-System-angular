import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantPublic } from '../models/tenant.model';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tenants`;

  constructor(private readonly http: HttpClient) {}

  /** Anonymous, cosmetic-only lookup for a branded login/signup page — 404s for an unknown slug.
   * Not called anywhere yet: wiring this to the browser's own subdomain waits on the wildcard DNS
   * setup this frontend has not been deployed behind. */
  getBySlug(slug: string): Observable<TenantPublic> {
    return this.http.get<TenantPublic>(`${this.baseUrl}/by-slug/${slug}`);
  }
}
