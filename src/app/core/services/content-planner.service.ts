import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AssetCandidates,
  AssetSummary,
  ConnectionsOverview,
  CreateProjectBody,
  ProjectDetail,
  ProjectSummary,
  Publication,
  PublishBody,
  RenderJob,
  ReviewState,
  ScriptVersion,
  SocialConnection,
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

  // ----- publishing (Admin only) -------------------------------------------------------------------------------------------

  connections(): Observable<ConnectionsOverview> {
    return this.http.get<ConnectionsOverview>(`${this.baseUrl}/connections`);
  }

  /** The Google sign-in address; `redirectUri` is the page Google sends the tenant back to. */
  youTubeConnectUrl(redirectUri: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.baseUrl}/connections/youtube/connect-url`, { params: new HttpParams().set('redirectUri', redirectUri) });
  }

  connectYouTube(code: string, state: string, redirectUri: string): Observable<SocialConnection> {
    return this.http.post<SocialConnection>(`${this.baseUrl}/connections/youtube/connect`, { code, state, redirectUri });
  }

  disconnect(connectionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/connections/${connectionId}`);
  }

  publish(versionId: string, body: PublishBody): Observable<Publication> {
    return this.http.post<Publication>(`${this.baseUrl}/versions/${versionId}/publish`, body);
  }

  publications(versionId: string): Observable<Publication[]> {
    return this.http.get<Publication[]>(`${this.baseUrl}/versions/${versionId}/publications`);
  }

  cancelPublication(id: string): Observable<Publication> {
    return this.http.post<Publication>(`${this.baseUrl}/publications/${id}/cancel`, {});
  }

  retryPublication(id: string): Observable<Publication> {
    return this.http.post<Publication>(`${this.baseUrl}/publications/${id}/retry`, {});
  }

  // ----- review and approval ------------------------------------------------------------------------------------------

  review(versionId: string): Observable<ReviewState> {
    return this.http.get<ReviewState>(`${this.baseUrl}/versions/${versionId}/review`);
  }

  submit(versionId: string, comment: string | null): Observable<ReviewState> {
    return this.http.post<ReviewState>(`${this.baseUrl}/versions/${versionId}/submit`, { comment });
  }

  withdraw(versionId: string, comment: string | null): Observable<ReviewState> {
    return this.http.post<ReviewState>(`${this.baseUrl}/versions/${versionId}/withdraw`, { comment });
  }

  approve(versionId: string, comment: string | null): Observable<ReviewState> {
    return this.http.post<ReviewState>(`${this.baseUrl}/versions/${versionId}/approve`, { comment });
  }

  reject(versionId: string, reason: string): Observable<ReviewState> {
    return this.http.post<ReviewState>(`${this.baseUrl}/versions/${versionId}/reject`, { reason });
  }

  /** Starts a new draft from an approved or rejected script; the original stays as it was. Returns the project with the new draft as its current script. */
  revise(versionId: string): Observable<ProjectDetail> {
    return this.http.post<ProjectDetail>(`${this.baseUrl}/versions/${versionId}/revise`, {});
  }

  // ----- videos ------------------------------------------------------------------------------------------------------------

  /** Starts making a video of a script version. The server charges first and returns the charge if it fails. */
  startRender(versionId: string, aspectRatio: string, voiceGender: string): Observable<RenderJob> {
    return this.http.post<RenderJob>(`${this.baseUrl}/versions/${versionId}/render`, { aspectRatio, voiceGender });
  }

  renders(versionId: string): Observable<RenderJob[]> {
    return this.http.get<RenderJob[]>(`${this.baseUrl}/versions/${versionId}/renders`);
  }

  render(jobId: string): Observable<RenderJob> {
    return this.http.get<RenderJob>(`${this.baseUrl}/render-jobs/${jobId}`);
  }

  cancelRender(jobId: string): Observable<RenderJob> {
    return this.http.post<RenderJob>(`${this.baseUrl}/render-jobs/${jobId}/cancel`, {});
  }

  /** The finished video, through the API (never a storage link); played from an object URL. */
  video(jobId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/render-jobs/${jobId}/video`, { responseType: 'blob' });
  }

  /** The picture itself, through the API (never a storage link); shown from an object URL. */
  assetContent(assetId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/assets/${assetId}/content`, { responseType: 'blob' });
  }
}
