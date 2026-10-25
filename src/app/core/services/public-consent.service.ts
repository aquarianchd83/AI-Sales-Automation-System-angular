import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { ConsentDecisionRequest, ConsentDecisionResult, PublicConsentPage } from '../models/consent-page.model';

/**
 * The customer's side of a consent link. Anonymous: the secret in the link is the only credential, so no bearer token is sent and no toast is
 * raised (the interceptors leave /public/ alone) - the page explains every outcome itself.
 *
 * The API answers a bad link with 404, an expired one with 410 and a refused choice with 4xx, each with a body that says what happened. Those
 * are results here, not errors; only a failure to reach the API at all (or a 5xx) is thrown.
 */
@Injectable({ providedIn: 'root' })
export class PublicConsentService {
  private readonly baseUrl = `${environment.apiBaseUrl}/public/consent`;

  constructor(private readonly http: HttpClient) {}

  /** What the link shows. Reading only - opening a link never records anything. */
  getPage(token: string): Observable<PublicConsentPage> {
    return this.http
      .get<PublicConsentPage>(`${this.baseUrl}/${encodeURIComponent(token)}`)
      .pipe(catchError((error: unknown) => this.asResult<PublicConsentPage>(error, (body) => typeof body['state'] === 'string')));
  }

  /** The customer's explicit choice. */
  decide(token: string, request: ConsentDecisionRequest): Observable<ConsentDecisionResult> {
    return this.http
      .post<ConsentDecisionResult>(`${this.baseUrl}/${encodeURIComponent(token)}/decision`, request)
      .pipe(catchError((error: unknown) => this.asResult<ConsentDecisionResult>(error, (body) => typeof body['outcome'] === 'string')));
  }

  private asResult<T>(error: unknown, isResult: (body: Record<string, unknown>) => boolean): Observable<T> {
    if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500 && error.status !== 429) {
      const body = error.error as Record<string, unknown> | null;
      if (body && typeof body === 'object' && isResult(body)) {
        return of(body as unknown as T);
      }
    }
    return throwError(() => error);
  }
}
