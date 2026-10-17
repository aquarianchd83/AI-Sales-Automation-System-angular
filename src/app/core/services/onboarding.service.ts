import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { OnboardingStatus, SKIPPABLE_STEP_KEYS } from '../models/onboarding.model';
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

  /** TEMPORARY (see SKIPPABLE_STEP_KEYS): the status as the server sent it, before skipped steps are applied. */
  private rawStatus: OnboardingStatus | null = null;

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
        this.rawStatus = status;
        this.statusSubject.next(this.applySkips(status));
      })
    );
  }

  /** TEMPORARY: puts a skippable step on hold so the steps after it open. Remembered in this browser only. */
  skipStep(key: string): void {
    if (!SKIPPABLE_STEP_KEYS.includes(key)) {
      return;
    }
    const skipped = this.readSkipped();
    if (!skipped.includes(key)) {
      this.writeSkipped([...skipped, key]);
    }
    this.statusSubject.next(this.applySkips(this.rawStatus));
  }

  private get skipStorageKey(): string {
    return `onboarding-skipped:${this.auth.currentUser?.id ?? ''}`;
  }

  private readSkipped(): string[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.skipStorageKey) ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeSkipped(keys: string[]): void {
    try {
      localStorage.setItem(this.skipStorageKey, JSON.stringify(keys));
    } catch {
      /* storage unavailable: the skip lasts until the status is next read */
    }
  }

  /** TEMPORARY: a skipped step that is still not done is marked Skipped, and the first remaining step becomes Current. */
  private applySkips(status: OnboardingStatus | null): OnboardingStatus | null {
    const skipped = this.readSkipped().filter((k) => SKIPPABLE_STEP_KEYS.includes(k));
    if (!status || status.isCompleted || !skipped.length) {
      return status;
    }
    let currentTaken = false;
    const steps = status.steps.map((step) => {
      if (step.state === 'Completed') {
        return step;
      }
      if (skipped.includes(step.key)) {
        return { ...step, state: 'Skipped' as const };
      }
      const state = currentTaken ? ('Pending' as const) : ('Current' as const);
      currentTaken = true;
      return { ...step, state };
    });
    const current = steps.find((s) => s.state === 'Current') ?? null;
    return {
      ...status,
      steps,
      currentStepKey: current?.key ?? null,
      isCompleted: !current,
    };
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
