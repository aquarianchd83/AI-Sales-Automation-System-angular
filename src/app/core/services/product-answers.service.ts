import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AnswerRevision, DraftRun, KnowledgeAnswersOverview, KnowledgeQuestion } from '../models/product-answers.model';

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

  // ----- the tenant's decisions ------------------------------------------------------------------------------------------------

  /** `confirmed` is the tenant's "I have checked this", required for a price, a guarantee, a weak answer or an unproven figure. */
  approve(answerId: string, confirmed: boolean): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/answers/${answerId}/approve`, { confirmed });
  }

  reject(answerId: string, reason: string | null): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/answers/${answerId}/reject`, { reason });
  }

  /** Takes an approved answer back for correction; the approval stays in the history. */
  reopen(answerId: string, note: string | null): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/answers/${answerId}/reopen`, { note });
  }

  /** The tenant's own answer: a correction, or what the sources lacked. A new version. */
  edit(questionId: string, summary: string, detail: string | null, confirmed: boolean): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/questions/${questionId}/edit`, { summary, detail, confirmed });
  }

  markUnknown(questionId: string): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/questions/${questionId}/unknown`, {});
  }

  markNotApplicable(questionId: string): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/questions/${questionId}/not-applicable`, {});
  }

  /** Chooses between values the sources disagree about. */
  resolveConflict(conflictId: string, chosenValue: string, note: string | null): Observable<KnowledgeQuestion> {
    return this.http.post<KnowledgeQuestion>(`${this.baseUrl}/conflicts/${conflictId}/resolve`, { chosenValue, note });
  }

  history(questionId: string): Observable<AnswerRevision[]> {
    return this.http.get<AnswerRevision[]>(`${this.baseUrl}/questions/${questionId}/history`);
  }
}
