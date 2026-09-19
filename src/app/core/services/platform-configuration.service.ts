import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformConfiguration } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformConfigurationService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/configuration`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<PlatformConfiguration> {
    return this.http.get<PlatformConfiguration>(this.baseUrl);
  }

  /** Replaces the whole document; takes effect on the next request, no restart. */
  save(configuration: PlatformConfiguration): Observable<PlatformConfiguration> {
    return this.http.put<PlatformConfiguration>(this.baseUrl, configuration);
  }
}
