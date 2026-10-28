import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TenantWhatsAppProvider, WhatsAppChannelStatus } from '../models/platform-whatsapp-provider.model';

/** The signed-in tenant's own WhatsApp provider and QR connection. The tenant can read which provider the Platform Admin chose, never change it. */
@Injectable({ providedIn: 'root' })
export class TenantWhatsAppBridgeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tenant-settings`;

  constructor(private readonly http: HttpClient) {}

  getProvider(): Observable<TenantWhatsAppProvider> {
    return this.http.get<TenantWhatsAppProvider>(`${this.baseUrl}/whatsapp-provider`);
  }

  getStatus(): Observable<WhatsAppChannelStatus> {
    return this.http.get<WhatsAppChannelStatus>(`${this.baseUrl}/whatsapp-bridge`);
  }

  connect(): Observable<WhatsAppChannelStatus> {
    return this.http.post<WhatsAppChannelStatus>(`${this.baseUrl}/whatsapp-bridge/connect`, {});
  }

  disconnect(): Observable<WhatsAppChannelStatus> {
    return this.http.post<WhatsAppChannelStatus>(`${this.baseUrl}/whatsapp-bridge/disconnect`, {});
  }

  remove(): Observable<WhatsAppChannelStatus> {
    return this.http.delete<WhatsAppChannelStatus>(`${this.baseUrl}/whatsapp-bridge`);
  }
}
