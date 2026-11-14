import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CleanupPreview, DatabaseSize } from '../models/platform.model';

/** PlatformSuperAdmin-only live read of database usage and per-table size (`/platform/database-size`). */
@Injectable({ providedIn: 'root' })
export class PlatformDatabaseSizeService {
  private readonly url = `${environment.apiBaseUrl}/platform/database-size`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<DatabaseSize> {
    return this.http.get<DatabaseSize>(this.url);
  }

  /** How much space the clean-up would free if it kept `keepDays` days. Counts only; deletes nothing. */
  getCleanupPreview(keepDays: number): Observable<CleanupPreview> {
    return this.http.get<CleanupPreview>(`${this.url}/cleanup-preview`, { params: { keepDays } });
  }
}
