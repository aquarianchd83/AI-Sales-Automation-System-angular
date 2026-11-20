import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AiProviderModel, SaveAiProviderModelRequest } from '../models/platform.model';

/** Platform Admin Console's AI Provider Models screen (PlatformSuperAdmin only). */
@Injectable({ providedIn: 'root' })
export class AiProviderModelService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/ai-provider-models`;

  constructor(private readonly http: HttpClient) {}

  getAll(provider?: string, search?: string): Observable<AiProviderModel[]> {
    let params = new HttpParams();
    if (provider) {
      params = params.set('provider', provider);
    }
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<AiProviderModel[]>(this.baseUrl, { params });
  }

  create(request: SaveAiProviderModelRequest): Observable<AiProviderModel> {
    return this.http.post<AiProviderModel>(this.baseUrl, request);
  }

  update(id: string, request: SaveAiProviderModelRequest): Observable<AiProviderModel> {
    return this.http.put<AiProviderModel>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
