import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  UpdateWhatsAppBridgeSettingsRequest,
  WhatsAppBridgeSettings,
  WhatsAppChannelStatus,
} from '../models/platform-whatsapp-provider.model';

@Injectable({ providedIn: 'root' })
export class PlatformWhatsAppBridgeService {
  private readonly platformUrl = `${environment.apiBaseUrl}/platform`;

  constructor(private readonly http: HttpClient) {}

  getSettings(): Observable<WhatsAppBridgeSettings> {
    return this.http.get<WhatsAppBridgeSettings>(`${this.platformUrl}/whatsapp-bridge-settings`);
  }

  /** The server proves the bridge answers with the key before saving; a rejected save answers 400 and keeps the stored settings. */
  saveSettings(request: UpdateWhatsAppBridgeSettingsRequest): Observable<WhatsAppBridgeSettings> {
    return this.http.put<WhatsAppBridgeSettings>(`${this.platformUrl}/whatsapp-bridge-settings`, request);
  }

  private channelUrl(tenantId: string): string {
    return `${this.platformUrl}/tenants/${tenantId}/whatsapp-bridge`;
  }

  getStatus(tenantId: string): Observable<WhatsAppChannelStatus> {
    return this.http.get<WhatsAppChannelStatus>(this.channelUrl(tenantId));
  }

  /** Starts or resumes pairing and returns a QR. Calling it again returns a fresh code. */
  connect(tenantId: string): Observable<WhatsAppChannelStatus> {
    return this.http.post<WhatsAppChannelStatus>(`${this.channelUrl(tenantId)}/connect`, {});
  }

  disconnect(tenantId: string): Observable<WhatsAppChannelStatus> {
    return this.http.post<WhatsAppChannelStatus>(`${this.channelUrl(tenantId)}/disconnect`, {});
  }

  remove(tenantId: string): Observable<WhatsAppChannelStatus> {
    return this.http.delete<WhatsAppChannelStatus>(this.channelUrl(tenantId));
  }
}
