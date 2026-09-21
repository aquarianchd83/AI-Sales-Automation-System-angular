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

/** PlatformEmbeddingStatusDto. */
export interface PlatformEmbeddingStatus {
  provider: string;
  model: string;
  isSimulated: boolean;
  keyMissing: boolean;
  /** Non-null when tenants on a real embedding provider would not find platform articles. */
  warning: string | null;
}

export interface UploadKnowledgeArticleResult {
  article: KnowledgeBaseArticle;
}

/** The platform's own (GLOBAL) knowledge base - PlatformSuperAdmin only. Answers every tenant's
 * product questions (refund policy, buying credits); the platform pays to embed it. */
@Injectable({ providedIn: 'root' })
export class PlatformKnowledgeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/knowledge`;

  constructor(private readonly http: HttpClient) {}

  getEmbeddingStatus(): Observable<PlatformEmbeddingStatus> {
    return this.http.get<PlatformEmbeddingStatus>(`${this.baseUrl}/embedding-status`);
  }

  getPaged(query: PagedQuery, status?: string): Observable<PagedResult<KnowledgeBaseArticle>> {
    const params = { ...toPagedParams(query), ...(status ? { status } : {}) };
    return this.http.get<PagedResult<KnowledgeBaseArticle>>(`${this.baseUrl}/articles`, { params });
  }

  create(request: CreateKnowledgeBaseArticleRequest): Observable<KnowledgeBaseArticle> {
    return this.http.post<KnowledgeBaseArticle>(`${this.baseUrl}/articles`, request);
  }

  update(id: string, request: UpdateKnowledgeBaseArticleRequest): Observable<KnowledgeBaseArticle> {
    return this.http.put<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/articles/${id}`);
  }

  /** securityReviewed acknowledges a review-level finding from the content scan. */
  publish(id: string, securityReviewed = false): Observable<KnowledgeBaseArticle> {
    const params = securityReviewed ? { securityReviewed: 'true' } : undefined;
    return this.http.post<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}/publish`, null, { params });
  }

  deprecate(id: string, note: string): Observable<KnowledgeBaseArticle> {
    return this.http.post<KnowledgeBaseArticle>(`${this.baseUrl}/articles/${id}/deprecate`, { note });
  }

  upload(file: File, sourceType?: string): Observable<UploadKnowledgeArticleResult> {
    const body = new FormData();
    body.append('file', file, file.name);
    if (sourceType) {
      body.append('sourceType', sourceType);
    }
    return this.http.post<UploadKnowledgeArticleResult>(`${this.baseUrl}/articles/upload`, body);
  }

  reindex(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reindex`, null);
  }
}
