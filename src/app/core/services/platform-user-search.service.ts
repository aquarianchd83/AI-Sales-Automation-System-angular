import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformUserSearchResult } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformUserSearchService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/users/search`;

  constructor(private readonly http: HttpClient) {}

  /** Mirrors the backend's own guard: a blank search returns nothing rather than every user on
   * the platform, so this skips the request entirely for an empty/whitespace term. Scoping to one
   * tenant lifts that guard - a blank term then lists that tenant's users. */
  search(term: string, tenantId?: string | null): Observable<PlatformUserSearchResult[]> {
    const trimmed = term.trim();
    if (!trimmed && !tenantId) {
      return of([]);
    }
    let params = new HttpParams();
    if (trimmed) {
      params = params.set('search', trimmed);
    }
    if (tenantId) {
      params = params.set('tenantId', tenantId);
    }
    return this.http.get<PlatformUserSearchResult[]>(this.baseUrl, { params });
  }
}
