import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';
import { PlatformStoryVideoRequestDetail, PlatformStoryVideoRequestRow, StoryVideoRequestStatus } from '../models/story-studio.model';

export interface PlatformStoryVideoRequestQuery extends PagedQuery {
  status?: StoryVideoRequestStatus;
  tenantId?: string;
}

/** The Story studio's video requests from every tenant: the platform admin writes the script and attaches the finished video. */
@Injectable({ providedIn: 'root' })
export class PlatformStoryVideoRequestService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/content-studio/video-requests`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PlatformStoryVideoRequestQuery): Observable<PagedResult<PlatformStoryVideoRequestRow>> {
    return this.http.get<PagedResult<PlatformStoryVideoRequestRow>>(this.baseUrl, {
      params: {
        ...toPagedParams(query),
        ...(query.status ? { Status: query.status } : {}),
        ...(query.tenantId ? { TenantId: query.tenantId } : {}),
      },
    });
  }

  get(id: string): Observable<PlatformStoryVideoRequestDetail> {
    return this.http.get<PlatformStoryVideoRequestDetail>(`${this.baseUrl}/${id}`);
  }

  /** Writes the script for the tenant. Not charged again: the video's price, taken when the request was raised, covers it. */
  generateScript(id: string): Observable<PlatformStoryVideoRequestDetail> {
    return this.http.post<PlatformStoryVideoRequestDetail>(`${this.baseUrl}/${id}/script`, {});
  }

  /** The video cannot be made: the credits go back to the tenant, who is told why (the reason is required). */
  reject(id: string, reason: string): Observable<PlatformStoryVideoRequestDetail> {
    return this.http.post<PlatformStoryVideoRequestDetail>(`${this.baseUrl}/${id}/reject`, { reason });
  }

  /** Uploads the finished video (field name `file`): stored under the tenant's folder, the link recorded, the tenant told in-app. */
  uploadVideo(id: string, file: File): Observable<PlatformStoryVideoRequestDetail> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<PlatformStoryVideoRequestDetail>(`${this.baseUrl}/${id}/video`, form);
  }
}
