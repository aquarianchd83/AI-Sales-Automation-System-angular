import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CompleteSocialAdsConnectRequest,
  ManualAdSpend,
  SaveManualAdSpendRequest,
  SocialAdsConnectUrl,
  SocialAdsStatus,
} from '../models/social-ads.model';

/** The tenant's Facebook / Instagram ad connection (Admin only). The API never returns the access token. */
@Injectable({ providedIn: 'root' })
export class SocialAdsService {
  private readonly baseUrl = `${environment.apiBaseUrl}/social-ads`;

  constructor(private readonly http: HttpClient) {}

  getStatus(): Observable<SocialAdsStatus> {
    return this.http.get<SocialAdsStatus>(this.baseUrl);
  }

  /** The Facebook login address; `redirectUri` is the page Facebook sends the tenant back to. */
  getConnectUrl(redirectUri: string): Observable<SocialAdsConnectUrl> {
    return this.http.get<SocialAdsConnectUrl>(`${this.baseUrl}/connect-url`, {
      params: new HttpParams().set('redirectUri', redirectUri),
    });
  }

  connect(request: CompleteSocialAdsConnectRequest): Observable<SocialAdsStatus> {
    return this.http.post<SocialAdsStatus>(`${this.baseUrl}/connect`, request);
  }

  selectAccount(adAccountId: string): Observable<SocialAdsStatus> {
    return this.http.post<SocialAdsStatus>(`${this.baseUrl}/select-account`, { adAccountId });
  }

  sync(): Observable<SocialAdsStatus> {
    return this.http.post<SocialAdsStatus>(`${this.baseUrl}/sync`, {});
  }

  disconnect(): Observable<void> {
    return this.http.delete<void>(this.baseUrl);
  }

  getManualSpend(): Observable<ManualAdSpend[]> {
    return this.http.get<ManualAdSpend[]>(`${this.baseUrl}/manual-spend`);
  }

  saveManualSpend(request: SaveManualAdSpendRequest): Observable<ManualAdSpend | null> {
    return this.http.put<ManualAdSpend | null>(`${this.baseUrl}/manual-spend`, request);
  }
}
