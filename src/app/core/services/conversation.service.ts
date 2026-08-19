import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AssignConversationRequest,
  ChangeConversationModeRequest,
  Conversation,
  ConversationMessage,
  SendConversationMessageRequest,
} from '../models/conversation.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class ConversationService {
  private readonly baseUrl = `${environment.apiBaseUrl}/conversations`;

  constructor(private readonly http: HttpClient) {}

  /** status filters to one ConversationStatus value (e.g. "Open") when given. */
  getPaged(query: PagedQuery, status?: string): Observable<PagedResult<Conversation>> {
    const params = { ...toPagedParams(query), ...(status ? { status } : {}) };
    return this.http.get<PagedResult<Conversation>>(this.baseUrl, { params });
  }

  getById(id: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.baseUrl}/${id}`);
  }

  /** The transcript — both directions, campaign-originated and agent-originated alike. */
  getMessages(id: string, query: PagedQuery): Observable<PagedResult<ConversationMessage>> {
    return this.http.get<PagedResult<ConversationMessage>>(`${this.baseUrl}/${id}/messages`, {
      params: toPagedParams(query),
    });
  }

  changeMode(id: string, request: ChangeConversationModeRequest): Observable<Conversation> {
    return this.http.put<Conversation>(`${this.baseUrl}/${id}/mode`, request);
  }

  assign(id: string, request: AssignConversationRequest): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.baseUrl}/${id}/assign`, request);
  }

  close(id: string): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.baseUrl}/${id}/close`, null);
  }

  /** The manual agent reply — see SendConversationMessageRequest for the customer service
   * window / template rules this enforces server-side. */
  sendMessage(id: string, request: SendConversationMessageRequest): Observable<ConversationMessage> {
    return this.http.post<ConversationMessage>(`${this.baseUrl}/${id}/messages`, request);
  }
}
