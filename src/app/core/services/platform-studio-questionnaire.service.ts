import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateQuestionnaireTemplateRequest,
  QuestionnaireTemplateDetail,
  QuestionnaireTemplateSummary,
  QuestionnaireValidation,
  UpdateQuestionnaireTemplateRequest,
} from '../models/content-studio.model';

/** The platform operator's questionnaire templates for the AI Content Studio (PlatformSuperAdmin only). */
@Injectable({ providedIn: 'root' })
export class PlatformStudioQuestionnaireService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/content-studio/questionnaire-templates`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<QuestionnaireTemplateSummary[]> {
    return this.http.get<QuestionnaireTemplateSummary[]>(this.baseUrl);
  }

  get(id: string): Observable<QuestionnaireTemplateDetail> {
    return this.http.get<QuestionnaireTemplateDetail>(`${this.baseUrl}/${id}`);
  }

  /** A starting definition to build a new template from. */
  getStarter(): Observable<{ definitionJson: string }> {
    return this.http.get<{ definitionJson: string }>(`${this.baseUrl}/starter`);
  }

  validate(definitionJson: string): Observable<QuestionnaireValidation> {
    return this.http.post<QuestionnaireValidation>(`${this.baseUrl}/validate`, { definitionJson });
  }

  create(request: CreateQuestionnaireTemplateRequest): Observable<QuestionnaireTemplateDetail> {
    return this.http.post<QuestionnaireTemplateDetail>(this.baseUrl, request);
  }

  update(id: string, request: UpdateQuestionnaireTemplateRequest): Observable<QuestionnaireTemplateDetail> {
    return this.http.put<QuestionnaireTemplateDetail>(`${this.baseUrl}/${id}`, request);
  }

  /** Starts a new draft version, copied from the newest one. */
  createVersion(id: string): Observable<QuestionnaireTemplateDetail> {
    return this.http.post<QuestionnaireTemplateDetail>(`${this.baseUrl}/${id}/versions`, {});
  }

  saveVersion(id: string, number: number, definitionJson: string): Observable<QuestionnaireTemplateDetail> {
    return this.http.put<QuestionnaireTemplateDetail>(`${this.baseUrl}/${id}/versions/${number}`, { definitionJson });
  }

  /** Irreversible: tenants are offered the version from now on. */
  publishVersion(id: string, number: number): Observable<QuestionnaireTemplateDetail> {
    return this.http.post<QuestionnaireTemplateDetail>(`${this.baseUrl}/${id}/versions/${number}/publish`, {});
  }
}
