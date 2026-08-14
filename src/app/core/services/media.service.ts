import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MediaAsset } from '../models/media.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly baseUrl = `${environment.apiBaseUrl}/media`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PagedQuery): Observable<PagedResult<MediaAsset>> {
    return this.http.get<PagedResult<MediaAsset>>(this.baseUrl, {
      params: toPagedParams(query),
    });
  }

  getById(id: string): Observable<MediaAsset> {
    return this.http.get<MediaAsset>(`${this.baseUrl}/${id}`);
  }

  /**
   * Uploads under the field name `file`. The API dedupes by content checksum — uploading
   * identical bytes twice returns the existing asset rather than creating a duplicate.
   */
  upload(file: File): Observable<HttpEvent<MediaAsset>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<MediaAsset>(`${this.baseUrl}/upload`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /**
   * Without `force`, deleting an asset still attached to a campaign step returns 409. Pass
   * `force: true` to delete it and drop those attachments.
   */
  delete(id: string, force = false): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`, {
      params: new HttpParams().set('force', String(force)),
    });
  }
}
