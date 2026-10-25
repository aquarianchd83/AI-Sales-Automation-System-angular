import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ConsentPagePreview, ConsentPageSettings, SaveConsentPageSettingsRequest } from '../models/consent-page.model';

/** The signed-in tenant's WhatsApp Consent Page Settings. There is no tenant id anywhere: the API acts for the tenant in the token. */
@Injectable({ providedIn: 'root' })
export class ConsentPageService {
  private readonly baseUrl = `${environment.apiBaseUrl}/consent-page-settings`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<ConsentPageSettings> {
    return this.http.get<ConsentPageSettings>(this.baseUrl);
  }

  /** Saves the draft. May be incomplete; it never changes what customers see. */
  save(request: SaveConsentPageSettingsRequest): Observable<ConsentPageSettings> {
    return this.http.put<ConsentPageSettings>(this.baseUrl, request);
  }

  /** The saved draft as a customer would see it. Nothing is stored or sent. */
  preview(): Observable<ConsentPagePreview> {
    return this.http.get<ConsentPagePreview>(`${this.baseUrl}/preview`);
  }

  /** Makes the saved draft the live page (a new version). The API refuses an incomplete one with the fields to fix. */
  publish(): Observable<ConsentPageSettings> {
    return this.http.post<ConsentPageSettings>(`${this.baseUrl}/publish`, {});
  }

  setActive(active: boolean): Observable<ConsentPageSettings> {
    return this.http.post<ConsentPageSettings>(`${this.baseUrl}/${active ? 'activate' : 'deactivate'}`, {});
  }
}
