import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CinematicScript,
  CreateStoryCharacterBody,
  CreateStoryProjectBody,
  GeneratedCharacter,
  SceneVideoProviderKind,
  StoryCharacter,
  StoryCheck,
  StoryPlatform,
  StoryPublication,
  StoryPublishPack,
  StoryCostEstimate,
  StoryProject,
  StoryClipScene,
  StoryReference,
  StoryRender,
  StoryScene,
  StoryScriptVersion,
  StoryUsage,
  VideoSource,
  VoiceOverResult,
} from '../models/story-studio.model';

/** The cinematic story studio: reusable characters, story projects, and the script that must be approved before any paid video work. */
@Injectable({ providedIn: 'root' })
export class StoryStudioService {
  private readonly baseUrl = `${environment.apiBaseUrl}/content-studio/stories`;

  constructor(private readonly http: HttpClient) {}

  listCharacters(search?: string): Observable<StoryCharacter[]> {
    let params = new HttpParams();
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<StoryCharacter[]>(`${this.baseUrl}/characters`, { params });
  }

  createCharacter(body: CreateStoryCharacterBody): Observable<StoryCharacter> {
    return this.http.post<StoryCharacter>(`${this.baseUrl}/characters`, body);
  }

  archiveCharacter(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/characters/${id}`);
  }

  /** The caller must have ticked the rights box; the server refuses otherwise. */
  uploadReference(characterId: string, file: File, rightsConfirmed: boolean): Observable<StoryReference> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('rightsConfirmed', String(rightsConfirmed));
    return this.http.post<StoryReference>(`${this.baseUrl}/characters/${characterId}/references`, form);
  }

  approveReference(characterId: string, referenceId: string): Observable<StoryReference> {
    return this.http.post<StoryReference>(`${this.baseUrl}/characters/${characterId}/references/${referenceId}/approve`, {});
  }

  listProjects(): Observable<StoryProject[]> {
    return this.http.get<StoryProject[]>(`${this.baseUrl}/projects`);
  }

  createProject(body: CreateStoryProjectBody): Observable<StoryProject> {
    return this.http.post<StoryProject>(`${this.baseUrl}/projects`, body);
  }

  setVideoProvider(projectId: string, provider: SceneVideoProviderKind): Observable<StoryProject> {
    return this.http.put<StoryProject>(`${this.baseUrl}/projects/${projectId}/video-provider`, { provider });
  }

  getCostEstimate(projectId: string): Observable<StoryCostEstimate> {
    return this.http.get<StoryCostEstimate>(`${this.baseUrl}/projects/${projectId}/cost-estimate`);
  }

  /** The current script, or a 404 when none has been written yet. */
  getScript(projectId: string): Observable<StoryScriptVersion> {
    return this.http.get<StoryScriptVersion>(`${this.baseUrl}/projects/${projectId}/script`);
  }

  generateScript(projectId: string): Observable<StoryScriptVersion> {
    return this.http.post<StoryScriptVersion>(`${this.baseUrl}/projects/${projectId}/script/generate`, {});
  }

  saveScript(projectId: string, script: CinematicScript): Observable<StoryScriptVersion> {
    return this.http.put<StoryScriptVersion>(`${this.baseUrl}/projects/${projectId}/script`, { script });
  }

  listScenes(projectId: string): Observable<StoryClipScene[]> {
    return this.http.get<StoryClipScene[]>(`${this.baseUrl}/projects/${projectId}/scenes`);
  }

  /** Starts every scene without a clip. A paid source needs confirmCost, which the server insists on. */
  generateClips(projectId: string, confirmCost: boolean): Observable<StoryClipScene[]> {
    return this.http.post<StoryClipScene[]>(`${this.baseUrl}/projects/${projectId}/clips/generate`, { confirmCost });
  }

  regenerateScene(sceneId: string, confirmCost: boolean): Observable<StoryClipScene> {
    return this.http.post<StoryClipScene>(`${this.baseUrl}/scenes/${sceneId}/regenerate`, { confirmCost });
  }

  /** The Flow path: the clip the user generated in Flow, for one scene. */
  uploadClip(sceneId: string, file: File): Observable<StoryClipScene> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<StoryClipScene>(`${this.baseUrl}/scenes/${sceneId}/clip`, form);
  }

  flagScene(sceneId: string, reason: string): Observable<StoryClipScene> {
    return this.http.post<StoryClipScene>(`${this.baseUrl}/scenes/${sceneId}/flag`, { reason });
  }

  listRenders(projectId: string): Observable<StoryRender[]> {
    return this.http.get<StoryRender[]>(`${this.baseUrl}/projects/${projectId}/renders`);
  }

  /** Puts the clips together with subtitles. Runs in the background; poll listRenders. */
  startRender(projectId: string): Observable<StoryRender> {
    return this.http.post<StoryRender>(`${this.baseUrl}/projects/${projectId}/renders`, {});
  }

  /** The finished video as a file (the request carries the sign-in, so it cannot be a plain link). */
  downloadVideo(renderId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/renders/${renderId}/video`, { responseType: 'blob' });
  }

  downloadClip(sceneId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/scenes/${sceneId}/clip`, { responseType: 'blob' });
  }

  /** Option C: makes the characters the script needs that are not already in the cast, with previews to approve. */
  generateCharacters(projectId: string, confirmCost: boolean): Observable<GeneratedCharacter[]> {
    return this.http.post<GeneratedCharacter[]>(`${this.baseUrl}/projects/${projectId}/characters/generate`, { confirmCost });
  }

  /** The subtitle text of one dialogue line; the clip's audio is not changed. */
  editDialogue(sceneId: string, order: number, text: string): Observable<StoryClipScene> {
    return this.http.put<StoryClipScene>(`${this.baseUrl}/scenes/${sceneId}/dialogue/${order}`, { text });
  }

  approveVideo(projectId: string): Observable<StoryProject> {
    return this.http.post<StoryProject>(`${this.baseUrl}/projects/${projectId}/approve-video`, {});
  }

  getUsage(projectId: string): Observable<StoryUsage> {
    return this.http.get<StoryUsage>(`${this.baseUrl}/projects/${projectId}/usage`);
  }

  /** Where clips can come from right now; Veo is off until the platform operator switches it on. */
  getVideoSources(): Observable<VideoSource[]> {
    return this.http.get<VideoSource[]>(`${this.baseUrl}/video-sources`);
  }

  /** What this host has and lacks for live use. Reports configuration only; calls no paid service. */
  getDiagnostics(): Observable<StoryCheck[]> {
    return this.http.get<StoryCheck[]>(`${this.baseUrl}/diagnostics`);
  }

  /** Replaces a scene's own audio with generated speech. A paid provider needs confirmCost. */
  addVoiceOver(sceneId: string, confirmCost: boolean): Observable<VoiceOverResult> {
    return this.http.post<VoiceOverResult>(`${this.baseUrl}/scenes/${sceneId}/voice-over`, { confirmCost });
  }

  getPublishPack(projectId: string): Observable<StoryPublishPack> {
    return this.http.get<StoryPublishPack>(`${this.baseUrl}/projects/${projectId}/publish-pack`);
  }

  /** Notes where the user shared the video. The studio does not post for them. */
  recordPublication(projectId: string, platform: StoryPlatform, url: string): Observable<StoryPublication> {
    return this.http.post<StoryPublication>(`${this.baseUrl}/projects/${projectId}/publications`, { platform, url });
  }

  approveScript(projectId: string): Observable<StoryScene[]> {
    return this.http.post<StoryScene[]>(`${this.baseUrl}/projects/${projectId}/script/approve`, {});
  }
}
