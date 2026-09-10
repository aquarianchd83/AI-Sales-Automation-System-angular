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
}
