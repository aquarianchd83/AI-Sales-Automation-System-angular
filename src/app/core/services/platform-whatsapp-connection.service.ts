import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformWhatsAppConnection } from '../models/platform.model';

@Injectable({ providedIn: 'root' })
export class PlatformWhatsAppConnectionService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/whatsapp-connections`;

  constructor(private readonly http: HttpClient) {}

  /** Not paged — one row per tenant that has ever connected a WABA. */
  getAll(): Observable<PlatformWhatsAppConnection[]> {
    return this.http.get<PlatformWhatsAppConnection[]>(this.baseUrl);
  }
}
