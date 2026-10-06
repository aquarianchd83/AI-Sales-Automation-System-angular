import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { OnboardingStatus } from '../models/onboarding.model';
import { AuthService } from './auth.service';

/**
 * The tenant's onboarding status. `status$` drives the shell (no sidenav, the onboarding bar) and the onboarding
 * page; the guard asks `current()` on every navigation while onboarding is incomplete, so a step completed on its
 * own screen is noticed on the very next click.
 *
 * Setup is checked live on the server, so it can reopen: delete the only customer package and that step is open
 * again. Every successful save or delete anywhere in the app (see OnboardingProgressInterceptor) therefore re-reads
 * the status shortly after - so a step completed inside the wizard's panel ticks off by itself, and a tenant whose
 * setup was just undone sees it (the shell then takes them back to the wizard).
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly url = `${environment.apiBaseUrl}/onboarding`;
  private readonly statusSubject = new BehaviorSubject<OnboardingStatus | null>(null);
  /** Whose status is cached, so a different sign-in in the same tab never sees someone else's. */
  private cachedFor: string | null = null;

  readonly status$ = this.statusSubject.asObservable();

  private readonly changes = new Subject<void>();

  constructor(private readonly http: HttpClient, private readonly auth: AuthService) {
    // A burst of saves (a form and its follow-up calls) is one re-read, not several.
    this.changes
      .pipe(
        debounceTime(600),
        switchMap(() => this.refresh().pipe(catchError(() => EMPTY)))
      )
      .subscribe();
  }

  /** Something was saved or deleted. Re-reads the status soon - completed or not, since a delete can reopen a step. */
  noteChange(): void {
    if (this.statusSubject.value) {
      this.changes.next();
    }
  }

  /** Null for a user with no tenant (the API answers 204). */
  refresh(): Observable<OnboardingStatus | null> {
    const userId = this.auth.currentUser?.id ?? null;
    return this.http.get<OnboardingStatus>(this.url, { observe: 'response' }).pipe(
      map((response) => (response.status === 204 ? null : response.body)),
      tap((status) => {
        this.cachedFor = userId;
        this.statusSubject.next(status);
      })
    );
  }

  /** The cached status when onboarding is completed for this user (kept fresh by noteChange); otherwise a fresh read. */
  current(): Observable<OnboardingStatus | null> {
    const cached = this.statusSubject.value;
    if (cached?.isCompleted && this.cachedFor === (this.auth.currentUser?.id ?? null)) {
      return of(cached);
    }
    return this.refresh();
  }
}
