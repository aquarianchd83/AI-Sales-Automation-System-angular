import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AssetCandidates,
  AssetSummary,
  CreateProjectBody,
  ProjectDetail,
  ProjectSummary,
  ScriptVersion,
  StudioAsset,
  UpdateSceneBody,
} from '../models/content-planner.model';

/** The AI Content Studio's planner (Admins and Sales Managers). Writing topics or a script is charged to the studio quota by the server. */
@Injectable({ providedIn: 'root' })
export class ContentPlannerService {
  private readonly baseUrl = `${environment.apiBaseUrl}/content-studio`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<ProjectSummary[]> {
    return this.http.get<ProjectSummary[]>(`${this.baseUrl}/projects`);
  }

  create(body: CreateProjectBody): Observable<ProjectDetail> {
    return this.http.post<ProjectDetail>(`${this.baseUrl}/projects`, body);
  }

  get(id: string): Observable<ProjectDetail> {
    return this.http.get<ProjectDetail>(`${this.baseUrl}/projects/${id}`);
  }

  update(id: string, body: Partial<CreateProjectBody>): Observable<ProjectDetail> {
    return this.http.put<ProjectDetail>(`${this.baseUrl}/projects/${id}`, body);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/projects/${id}`);
  }

  /** Asks the AI for topic ideas that rest on the verified facts. */
  generateTopics(id: string, count: number | null): Observable<ProjectDetail> {
    return this.http.post<ProjectDetail>(`${this.baseUrl}/projects/${id}/topics/generate`, { count });
  }

  /** Choose, reject or restore an idea (`status`), or reword it (`title`). */
  updateTopic(topicId: string, body: { title?: string; status?: string }): Observable<ProjectDetail> {
    return this.http.put<ProjectDetail>(`${this.baseUrl}/topics/${topicId}`, body);
  }

  /** Writes a new script version for the chosen topic (or `topicId`). */
  generateScript(id: string, body: { topicId: string | null; targetSeconds: number | null; notes: string | null }): Observable<ProjectDetail> {
    return this.http.post<ProjectDetail>(`${this.baseUrl}/projects/${id}/script/generate`, body);
  }

  getVersion(versionId: string): Observable<ScriptVersion> {
    return this.http.get<ScriptVersion>(`${this.baseUrl}/versions/${versionId}`);
  }

  /** Checks every scene again against the facts as they are now. */
  recheck(versionId: string): Observable<ScriptVersion> {
    return this.http.post<ScriptVersion>(`${this.baseUrl}/versions/${versionId}/claim-check`, {});
  }

  updateScene(sceneId: string, body: UpdateSceneBody): Observable<ScriptVersion> {
    return this.http.put<ScriptVersion>(`${this.baseUrl}/scenes/${sceneId}`, body);
  }

  deleteScene(sceneId: string): Observable<ScriptVersion> {
    return this.http.delete<ScriptVersion>(`${this.baseUrl}/scenes/${sceneId}`);
  }

  // ----- pictures ----------------------------------------------------------------------------------------------------------

  /** Ranked pictures for a scene; with `includeStock` the stock library is searched too (`query` or the scene's own picture note). */
  candidates(sceneId: string, includeStock: boolean, query: string | null): Observable<AssetCandidates> {
    let params = new HttpParams().set('includeStock', String(includeStock));
    if (query) {
      params = params.set('query', query);
    }
    return this.http.get<AssetCandidates>(`${this.baseUrl}/scenes/${sceneId}/assets/candidates`, { params });
  }

  /** Sets the scene's picture: one of the tenant's own (`assetId`) or a stock photo (`stockProviderAssetId`), which the server copies with its licence. */
  chooseAsset(sceneId: string, body: { assetId: string | null; stockProviderAssetId: string | null }): Observable<AssetSummary> {
    return this.http.put<AssetSummary>(`${this.baseUrl}/scenes/${sceneId}/asset`, body);
  }

  clearAsset(sceneId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/scenes/${sceneId}/asset`);
  }

  /** Multipart: file, kind, name, tags and the two confirmations. */
  uploadAsset(form: FormData): Observable<StudioAsset> {
    return this.http.post<StudioAsset>(`${this.baseUrl}/assets`, form);
  }

  /** The picture itself, through the API (never a storage link); shown from an object URL. */
  assetContent(assetId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/assets/${assetId}/content`, { responseType: 'blob' });
  }
}
