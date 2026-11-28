import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PlatformConversation,
  PlatformConversationContact,
  PlatformConversationDetail,
  PlatformConversationInvite,
  PlatformConversationMessage,
  PlatformConversationTemplate,
  SendPlatformConversationMessageRequest,
  StartPlatformConversationRequest,
} from '../models/platform-conversation.model';

/** Tenant Conversations (`/platform/conversations`): chat with tenants on WhatsApp from the platform's own number. */
@Injectable({ providedIn: 'root' })
export class PlatformConversationService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/conversations`;

  constructor(private readonly http: HttpClient) {}

  list(search?: string): Observable<PlatformConversation[]> {
    return this.http.get<PlatformConversation[]>(this.baseUrl, {
      params: search ? { search } : {},
    });
  }

  /** The newest messages, or those before `before` (UTC, as the API sent it) for "load older". Opening a chat marks it read. */
  get(
    id: string,
    before?: string,
    take = 50,
  ): Observable<PlatformConversationDetail> {
    const params: Record<string, string> = { take: String(take) };
    if (before) {
      params['before'] = before;
    }
    return this.http.get<PlatformConversationDetail>(`${this.baseUrl}/${id}`, {
      params,
    });
  }

  contacts(search?: string): Observable<PlatformConversationContact[]> {
    return this.http.get<PlatformConversationContact[]>(
      `${this.baseUrl}/contacts`,
      { params: search ? { search } : {} },
    );
  }

  templates(): Observable<PlatformConversationTemplate[]> {
    return this.http.get<PlatformConversationTemplate[]>(
      `${this.baseUrl}/templates`,
    );
  }

  start(
    request: StartPlatformConversationRequest,
  ): Observable<PlatformConversation> {
    return this.http.post<PlatformConversation>(this.baseUrl, request);
  }

  send(
    id: string,
    request: SendPlatformConversationMessageRequest,
  ): Observable<PlatformConversationMessage> {
    return this.http.post<PlatformConversationMessage>(
      `${this.baseUrl}/${id}/messages`,
      request,
    );
  }

  /** The wa.me link to the platform number and the tenant's email. */
  invite(id: string): Observable<PlatformConversationInvite> {
    return this.http.get<PlatformConversationInvite>(
      `${this.baseUrl}/${id}/invite`,
    );
  }

  /** Emails the tenant the wa.me link; the email shows up in the chat as its own message. */
  emailInvite(
    id: string,
    note: string | null,
  ): Observable<PlatformConversationMessage> {
    return this.http.post<PlatformConversationMessage>(
      `${this.baseUrl}/${id}/invite/email`,
      { note },
    );
  }
}
