import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MediaAsset } from '../models/media.model';

/** The platform's own media library - the images the WhatsApp notice templates show. Not a tenant's library. */
@Injectable({ providedIn: 'root' })
export class PlatformMediaService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/media`;

  constructor(private readonly http: HttpClient) {}

  getAll(search?: string): Observable<MediaAsset[]> {
    let params = new HttpParams();
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<MediaAsset[]>(this.baseUrl, { params });
  }

  /** Uploads under the field name `file`. Identical bytes return the existing entry rather than a duplicate. */
  upload(file: File): Observable<MediaAsset> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<MediaAsset>(`${this.baseUrl}/upload`, form);
  }

  /** Swaps the file behind an entry, keeping its id - so every template using it follows. */
  replace(id: string, file: File): Observable<MediaAsset> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<MediaAsset>(`${this.baseUrl}/${id}/replace`, form);
  }

  /** Refused (409) while a template still shows the image. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
