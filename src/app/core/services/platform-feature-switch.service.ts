import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformFeature, PlatformFeatureSwitch } from '../models/wallet.model';

@Injectable({ providedIn: 'root' })
export class PlatformFeatureSwitchService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/features`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<PlatformFeatureSwitch[]> {
    return this.http.get<PlatformFeatureSwitch[]>(this.baseUrl);
  }

  /** Takes effect on the next request, no restart. */
  setPublished(feature: PlatformFeature, published: boolean): Observable<PlatformFeatureSwitch> {
    return this.http.put<PlatformFeatureSwitch>(`${this.baseUrl}/${feature}`, { published });
  }
}
