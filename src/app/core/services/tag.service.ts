import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';
import { CreateTagRequest, Tag, UpdateTagRequest } from '../models/tag.model';

@Injectable({ providedIn: 'root' })
export class TagService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tags`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PagedQuery): Observable<PagedResult<Tag>> {
    return this.http.get<PagedResult<Tag>>(this.baseUrl, {
      params: toPagedParams(query),
    });
  }

  getById(id: string): Observable<Tag> {
    return this.http.get<Tag>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateTagRequest): Observable<Tag> {
    return this.http.post<Tag>(this.baseUrl, request);
  }

  /** Renaming re-labels the tag everywhere it's applied — the join table holds ids. */
  update(id: string, request: UpdateTagRequest): Observable<Tag> {
    return this.http.put<Tag>(`${this.baseUrl}/${id}`, request);
  }

  /**
   * Without `force`, deleting a tag still applied to customers returns 409 with the
   * count in the message. Pass `force: true` to delete it and drop those assignments.
   */
  delete(id: string, force = false): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      params: new HttpParams().set('force', String(force)),
    });
  }
}
