import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CinematicScript,
  CreateStoryCharacterBody,
  CreateStoryProjectBody,
  SceneVideoProviderKind,
  StoryCharacter,
  StoryCostEstimate,
  StoryProject,
  StoryClipScene,
  StoryReference,
  StoryScene,
  StoryScriptVersion,
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

  approveScript(projectId: string): Observable<StoryScene[]> {
    return this.http.post<StoryScene[]>(`${this.baseUrl}/projects/${projectId}/script/approve`, {});
  }
}
