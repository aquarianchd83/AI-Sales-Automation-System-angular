import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { DraftRun, KnowledgeAnswersOverview, KnowledgeQuestion } from '../models/product-answers.model';

/** Drafted answers for the tenant's product questions (tenant Admin only). */
@Injectable({ providedIn: 'root' })
export class ProductAnswersService {
  private readonly baseUrl = `${environment.apiBaseUrl}/product-knowledge`;

  constructor(private readonly http: HttpClient) {}

  get(): Observable<KnowledgeAnswersOverview> {
    return this.http.get<KnowledgeAnswersOverview>(`${this.baseUrl}/answers`);
  }

  /** Drafts every question from the sources in the background; returns the run to follow. */
  startDraft(): Observable<DraftRun> {
    return this.http.post<DraftRun>(`${this.baseUrl}/draft`, {});
  }

  /** Another suggestion for one question. */
  redraft(questionId: string): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/questions/${questionId}/draft`, {});
  }

  /** The tenant's own question, answered from their sources at once. */
  ask(text: string): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/questions`, { text });
  }

  removeQuestion(questionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/questions/${questionId}`);
  }
}
