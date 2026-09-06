import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateMessageTemplateRequest,
  MessageTemplate,
  MessageTemplateSyncOneResult,
  ReviewMessageTemplateRequest,
  UpdateMessageTemplateRequest,
} from '../models/message-template.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class MessageTemplateService {
  private readonly baseUrl = `${environment.apiBaseUrl}/message-templates`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PagedQuery): Observable<PagedResult<MessageTemplate>> {
    return this.http.get<PagedResult<MessageTemplate>>(this.baseUrl, {
      params: toPagedParams(query),
    });
  }

  getById(id: string): Observable<MessageTemplate> {
    return this.http.get<MessageTemplate>(`${this.baseUrl}/${id}`);
  }

  /** New templates always start Pending — there is no way to create one pre-approved. */
  create(request: CreateMessageTemplateRequest): Observable<MessageTemplate> {
    return this.http.post<MessageTemplate>(this.baseUrl, request);
  }

  update(id: string, request: UpdateMessageTemplateRequest): Observable<MessageTemplate> {
    return this.http.put<MessageTemplate>(`${this.baseUrl}/${id}`, request);
  }

  /** Stands in for Meta's real review process. SuperAdmin/Admin only — the API 403s otherwise. */
  review(id: string, request: ReviewMessageTemplateRequest): Observable<MessageTemplate> {
    return this.http.post<MessageTemplate>(`${this.baseUrl}/${id}/review`, request);
  }

  /** 409s if any campaign step still references this template — no force option. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Pushes this one template to Meta (create if never synced, else edit if its body changed) and
   *  pulls back its resulting review status — the per-row Sync button. SuperAdmin/Admin only. */
  syncOne(id: string): Observable<MessageTemplateSyncOneResult> {
    return this.http.post<MessageTemplateSyncOneResult>(`${this.baseUrl}/${id}/sync`, {});
  }
}
