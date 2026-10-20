import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { KnowledgeVersion, KnowledgeVersionDetail, KnowledgeVersionsOverview } from '../models/published-knowledge.model';

/** Publishing the approved answers as a version, and the record of what was published (tenant Admin only). */
@Injectable({ providedIn: 'root' })
export class PublishedKnowledgeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/product-knowledge/versions`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<KnowledgeVersionsOverview> {
    return this.http.get<KnowledgeVersionsOverview>(this.baseUrl);
  }

  getVersion(id: string): Observable<KnowledgeVersionDetail> {
    return this.http.get<KnowledgeVersionDetail>(`${this.baseUrl}/${id}`);
  }

  publish(note: string | null): Observable<KnowledgeVersion> {
    return this.http.post<KnowledgeVersion>(`${this.baseUrl}/publish`, { note });
  }

  /** The working Draft file (plain text): every question and answer, headed as not approved. */
  draftFile(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/draft-file`, { responseType: 'blob' });
  }

  /** The Final file (plain text) of one version: its approved answers only. */
  finalFile(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/file`, { responseType: 'blob' });
  }

  /** Makes a new version that copies an older one; nothing is erased. */
  restore(id: string, note: string | null): Observable<KnowledgeVersion> {
    return this.http.post<KnowledgeVersion>(`${this.baseUrl}/${id}/restore`, { note });
  }
}
