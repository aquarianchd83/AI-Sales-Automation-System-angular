import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformUserSearchResult } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformUserSearchService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/users/search`;

  constructor(private readonly http: HttpClient) {}

  /** Mirrors the backend's own guard: a blank search returns nothing rather than every user on
   * the platform, so this skips the request entirely for an empty/whitespace term. */
  search(term: string): Observable<PlatformUserSearchResult[]> {
    if (!term.trim()) {
      return of([]);
    }
    return this.http.get<PlatformUserSearchResult[]>(this.baseUrl, {
      params: { search: term.trim() },
    });
  }

  /** Support reset: sets the user's password and signs them out everywhere. Audited by the API. */
  resetPassword(userId: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/platform/users/${userId}/reset-password`, { newPassword });
  }

  /** Every user of one organization - the Tenants grid's Users count opens this. */
  listForTenant(tenantId: string): Observable<PlatformUserSearchResult[]> {
    return this.http.get<PlatformUserSearchResult[]>(`${environment.apiBaseUrl}/platform/tenants/${tenantId}/users`);
  }
}
