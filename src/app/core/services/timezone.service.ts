import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TimeZoneOption } from '../models/billing.model';

/** The public timezone catalog (GET /timezones, no auth required) — the signup page's picker, the
 * tenant's own Workspace settings editor, and the Platform Admin Console's tenant detail override
 * all read from this same service, so none of them can drift out of sync with each other. */
@Injectable({ providedIn: 'root' })
export class TimeZoneService {
  private readonly baseUrl = `${environment.apiBaseUrl}/timezones`;

  constructor(private readonly http: HttpClient) {}

  getTimezones(): Observable<TimeZoneOption[]> {
    return this.http.get<TimeZoneOption[]>(this.baseUrl);
  }
}
