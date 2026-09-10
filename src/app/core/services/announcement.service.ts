import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  Announcement,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from '../models/platform.model';

/** Backs both the Platform Admin Console's Announcements screen (PlatformSuperAdmin CRUD) and
 * the dismissible banner every signed-in user sees (getActive) — see AnnouncementsController's
 * own doc comment on the backend for why both live on the one controller/service. */
@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  private readonly baseUrl = `${environment.apiBaseUrl}/announcements`;

  constructor(private readonly http: HttpClient) {}

  /** Any authenticated user, any tenant — the whole point of a broadcast banner. */
  getActive(): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(`${this.baseUrl}/active`);
  }

  /** PlatformSuperAdmin-only, enforced by the API. */
  getAll(): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(this.baseUrl);
  }

  create(request: CreateAnnouncementRequest): Observable<Announcement> {
    return this.http.post<Announcement>(this.baseUrl, request);
  }

  update(id: string, request: UpdateAnnouncementRequest): Observable<Announcement> {
    return this.http.put<Announcement>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
