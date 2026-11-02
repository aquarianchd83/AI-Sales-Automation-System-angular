import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CreateQualificationFieldRequest,
  NextStep,
  QualificationField,
  UpdateQualificationFieldRequest,
} from '../models/qualification.model';

@Injectable({ providedIn: 'root' })
export class QualificationService {
  private readonly baseUrl = `${environment.apiBaseUrl}/qualification/fields`;

  constructor(private readonly http: HttpClient) {}

  list(): Observable<QualificationField[]> {
    return this.http.get<QualificationField[]>(this.baseUrl);
  }

  create(request: CreateQualificationFieldRequest): Observable<QualificationField> {
    return this.http.post<QualificationField>(this.baseUrl, request);
  }

  update(id: string, request: UpdateQualificationFieldRequest): Observable<QualificationField> {
    return this.http.put<QualificationField>(`${this.baseUrl}/${id}`, request);
  }

  /** Turns a question off (or back on) without touching answers already captured - what "remove" almost always means. */
  setActive(id: string, isActive: boolean): Observable<QualificationField> {
    return this.http.post<QualificationField>(`${this.baseUrl}/${id}/active`, null, {
      params: new HttpParams().set('isActive', String(isActive)),
    });
  }

  /** Refused with 409 when any lead has an answer for it - turn it off instead. */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  reorder(orderedIds: string[]): Observable<QualificationField[]> {
    return this.http.post<QualificationField[]>(`${this.baseUrl}/reorder`, { orderedIds });
  }

  getNextStep(): Observable<NextStep> {
    return this.http.get<NextStep>(`${environment.apiBaseUrl}/qualification/next-step`);
  }

  /** The step the AI may mention once, mid-conversation. "Enquiry" means none. */
  setNextStep(goal: string, detail: string | null): Observable<NextStep> {
    return this.http.put<NextStep>(`${environment.apiBaseUrl}/qualification/next-step`, { goal, detail });
  }

  /** Adds budget / interest / purchase timeline when the tenant has none. Additive and safe to repeat. */
  seedDefaults(): Observable<QualificationField[]> {
    return this.http.post<QualificationField[]>(`${this.baseUrl}/seed-defaults`, null);
  }
}
