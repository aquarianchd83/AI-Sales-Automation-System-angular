import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { KnowledgeSource, KnowledgeSourceDetail, KnowledgeSourcesOverview } from '../models/product-knowledge.model';

/** The tenant's product-knowledge sources (tenant Admin only). Files come back through the API, never as storage links. */
@Injectable({ providedIn: 'root' })
export class ProductKnowledgeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/product-knowledge/sources`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<KnowledgeSourcesOverview> {
    return this.http.get<KnowledgeSourcesOverview>(this.baseUrl);
  }

  get(id: string): Observable<KnowledgeSourceDetail> {
    return this.http.get<KnowledgeSourceDetail>(`${this.baseUrl}/${id}`);
  }

  upload(file: File): Observable<KnowledgeSource> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<KnowledgeSource>(`${this.baseUrl}/documents`, form);
  }

  addWebsite(url: string): Observable<KnowledgeSource> {
    return this.http.post<KnowledgeSource>(`${this.baseUrl}/websites`, { url });
  }

  /** Reads a failed source again, or scans a website again. */
  retry(id: string): Observable<KnowledgeSource> {
    return this.http.post<KnowledgeSource>(`${this.baseUrl}/${id}/retry`, {});
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** The original upload (`original`) or the text that was read (`text`). */
  download(id: string, which: 'original' | 'text'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/${which}`, { responseType: 'blob' });
  }
}
