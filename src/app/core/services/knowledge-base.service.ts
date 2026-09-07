import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AvailableAiProviders,
  BulkPublishArticlesResult,
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

  /** No `provider`: full canonical publish — re-chunks Content, embeds it via every available
   * embedding provider, replaces all previous chunks/embeddings, and marks the article Published.
   * Safe to call again on an already-Published article to pick up an edit.
   *
   * With `provider` ("Simulated"/"OpenAI"/"Google"): targeted publish — only (re)embeds via that
   * one provider, leaving every other provider's existing embeddings for this article untouched;
   * does not record approval. Used to backfill/refresh one embedding provider without disturbing
   * the others — see ArticleEmbeddingProvider. */
  publish(id: string, provider?: string): Observable<KnowledgeBaseArticle> {
    const params = provider ? { provider } : undefined;
    return this.http.post<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}/publish`, null, { params });
  }

  /** Re-chunks/re-embeds every Published article whose chunks are stale against its current
   * Version — the bulk counterpart to publishing one article by hand. */
  reindex(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reindex`, null);
  }

  /** Publishes several selected articles in one request — each still re-chunks/re-embeds
   * individually server-side, so this can partially succeed; see BulkPublishArticlesResult. */
  bulkPublish(ids: string[]): Observable<BulkPublishArticlesResult> {
    return this.http.post<BulkPublishArticlesResult>(`${this.baseUrl}/articles/bulk-publish`, { ids });
  }

  /** Makes the article eligible for retrieval when `provider` is the active chat model. Chunks +
   * embeds it first if it was still Draft — safe to call again for a model it's already published
   * to (just refreshes the publish timestamp). */
  publishToModel(id: string, provider: string): Observable<KnowledgeBaseArticle> {
    return this.http.post<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}/models/${provider}`, null);
  }

  /** Removes the article's eligibility for `provider`'s retrieval — a no-op if it wasn't
   * published to that model. Does not touch Status or its embedded chunks. */
  unpublishFromModel(id: string, provider: string): Observable<KnowledgeBaseArticle> {
    return this.http.delete<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}/models/${provider}`);
  }

  /** Which chat models and embedding providers actually have an API key configured — used to hide
   * publish/embed badges for providers that could never do anything in this deployment. */
  getAvailableProviders(): Observable<AvailableAiProviders> {
    return this.http.get<AvailableAiProviders>(`${this.baseUrl}/available-providers`);
  }
}
