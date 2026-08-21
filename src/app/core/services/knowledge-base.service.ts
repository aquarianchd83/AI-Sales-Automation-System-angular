import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateKnowledgeBaseArticleRequest,
  KnowledgeBaseArticle,
  UpdateKnowledgeBaseArticleRequest,
} from '../models/knowledge-base.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class KnowledgeBaseService {
  private readonly baseUrl = `${environment.apiBaseUrl}/knowledge-base`;

  constructor(private readonly http: HttpClient) {}

  /** status filters to one KnowledgeBaseArticleStatus value (e.g. "Published") when given. */
  getPaged(query: PagedQuery, status?: string): Observable<PagedResult<KnowledgeBaseArticle>> {
    const params = { ...toPagedParams(query), ...(status ? { status } : {}) };
    return this.http.get<PagedResult<KnowledgeBaseArticle>>(`${this.baseUrl}/articles`, { params });
  }

  getById(id: string): Observable<KnowledgeBaseArticle> {
    return this.http.get<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}`);
  }

  create(request: CreateKnowledgeBaseArticleRequest): Observable<KnowledgeBaseArticle> {
    return this.http.post<KnowledgeBaseArticle>(`${this.baseUrl}/articles`, request);
  }

  /** Bumps Version but does not re-chunk/re-embed by itself — publish() or reindex() picks up
   * the new content. */
  update(id: string, request: UpdateKnowledgeBaseArticleRequest): Observable<KnowledgeBaseArticle> {
    return this.http.put<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}`, request);
  }

  /** Soft delete — a currently-Published article's already-embedded chunks go with it. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/articles/${id}`);
  }

  /** Chunks + embeds the article's current content and marks it Published. Safe to call again
   * on an already-Published article to pick up an edit. */
  publish(id: string): Observable<KnowledgeBaseArticle> {
    return this.http.post<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}/publish`, null);
  }

  /** Re-chunks/re-embeds every Published article whose chunks are stale against its current
   * Version — the bulk counterpart to publishing one article by hand. */
  reindex(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reindex`, null);
  }
}
