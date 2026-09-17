import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import {
  AuthResult,
  ChangePasswordRequest,
  LoginRequest,
  readAccessTokenClaims,
  RefreshTokenRequest,
  SignUpRequest,
} from '../models/auth.model';
import { User } from '../models/user.model';
import { TokenStorageService } from './token-storage.service';
import { UserPreferencesService } from './user-preferences.service';

const USER_KEY = 'wsa.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;
  private readonly currentUserSubject = new BehaviorSubject<User | null>(null);

  /** In-flight refresh, shared so parallel 401s trigger exactly one call. */
  private refresh$: Observable<string> | null = null;

  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenStorageService,
    private readonly router: Router,
    private readonly preferences: UserPreferencesService
  ) {
    this.restoreSession();
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.tokens.accessToken && !!this.currentUser;
  }

  /** True while the current session is a Platform Admin Console impersonation (support) session
   * rather than a normal login — read from the access token's own `impersonated_by` claim, not
   * from any separate flag, so it can never drift out of sync with what the token actually is. */
  get isImpersonating(): boolean {
    return !!readAccessTokenClaims(this.tokens.decodeAccessToken() ?? {}).impersonatedByUserId;
  }

  hasAnyRole(roles: string[]): boolean {
    if (!roles.length) {
      return true;
    }
    const mine = this.currentUser?.roles ?? [];
    return roles.some((role) => mine.includes(role));
  }

  login(request: LoginRequest): Observable<User> {
    return this.http.post<AuthResult>(`${this.baseUrl}/login`, request).pipe(
      tap((result) => this.acceptAuthResult(result)),
      map((result) => result.user)
    );
  }

  /** The only self-serve account-creation path: creates a new Tenant (on a 14-day trial) and its
   * first Admin user in one call, then logs that user in exactly like login() would. */
  signUp(request: SignUpRequest): Observable<User> {
    return this.http.post<AuthResult>(`${this.baseUrl}/signup`, request).pipe(
      tap((result) => this.acceptAuthResult(result)),
      map((result) => result.user)
    );
  }

  /**
   * Rotates the token pair. Concurrent callers share one HTTP request; a failure
   * clears the session so the caller can bounce the user to /login.
   */
  refreshAccessToken(): Observable<string> {
    if (this.refresh$) {
      return this.refresh$;
    }

    const refreshToken = this.tokens.refreshToken;
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available.'));
    }

    const body: RefreshTokenRequest = { refreshToken };
    this.refresh$ = this.http.post<AuthResult>(`${this.baseUrl}/refresh-token`, body).pipe(
      tap((result) => this.acceptAuthResult(result)),
      map((result) => result.accessToken),
      catchError((error) => {
        this.clearSession();
        return throwError(() => error);
      }),
      finalize(() => (this.refresh$ = null)),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    return this.refresh$;
  }

  /** Tells the API to revoke the refresh token, then clears local state regardless. */
  logout(redirect = true): void {
    const refreshToken = this.tokens.refreshToken;
    if (refreshToken) {
      this.http
        .post(`${this.baseUrl}/logout`, { refreshToken } as RefreshTokenRequest)
        .pipe(catchError(() => []))
        .subscribe();
    }
    this.clearSession();
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/change-password`, request);
  }

  /**
   * Loads an impersonation access token (Platform Admin Console) as the active session. Deliberately
   * separate from acceptAuthResult: there is no refresh token to pair it with (see
   * ImpersonationSession's own doc comment) and no UserDto in the response, so the display user is
   * built entirely from the token's own claims — the same claim-derived path restoreSession falls
   * back to, just always taken here since a support session is never the "first ever login" case.
   *
   * Callers must only do this in a fresh browser tab (see ImpersonationSessionService). Both the
   * token (via TokenStorageService.storeImpersonation) and the display user built from it here stay
   * in memory rather than localStorage — the tab this runs in shares localStorage with the
   * PlatformSuperAdmin's own Platform Admin Console tab that opened it, so writing either there
   * would silently replace the operator's own session on their original tab, not just this one. A
   * side effect: a manual page refresh ends the support session (nothing persists it) — an
   * acceptable trade-off for a short-lived, security-sensitive session that's meant to be reopened
   * from the console, not relied on to survive a reload.
   */
  beginImpersonationSession(accessToken: string): void {
    this.tokens.storeImpersonation(accessToken);
    const claims = readAccessTokenClaims(this.tokens.decodeAccessToken() ?? {});
    const user: User = {
      id: claims.id,
      fullName: claims.name,
      email: claims.email,
      phoneNumber: null,
      isActive: true,
      roles: claims.roles,
      createdAt: '',
      lastLoginAt: null,
    };
    this.currentUserSubject.next(user);
  }

  /** Ends a support session — no server call (there is no refresh token to revoke; the access
   * token simply expires on its own within its 30-minute lifetime regardless). Callers decide what
   * happens to the tab (see ImpersonationBannerComponent, which closes it when it was opened via
   * window.open and otherwise falls back to /login). */
  endImpersonation(): void {
    this.clearSession();
  }

  /** Called by the error interceptor when a refresh attempt is unrecoverable. */
  forceLogout(returnUrl?: string): void {
    this.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: returnUrl ? { returnUrl } : undefined,
    });
  }

  private acceptAuthResult(result: AuthResult): void {
    this.tokens.store(result.accessToken, result.refreshToken);
    if (result.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      this.currentUserSubject.next(result.user);
    }
  }

  private clearSession(): void {
    // Read before clearing — isImpersonating decodes the current access token, which
    // tokens.clear() below is about to erase. An impersonation session's display user was never
    // written to localStorage in the first place (see beginImpersonationSession), so there's
    // nothing of this tab's own to remove there; more importantly, removing USER_KEY
    // unconditionally would also wipe it from the PlatformSuperAdmin's own tab, since
    // localStorage is shared across same-origin tabs.
    const wasImpersonating = this.isImpersonating;
    this.tokens.clear();
    if (!wasImpersonating) {
      localStorage.removeItem(USER_KEY);
      // Same reasoning as USER_KEY above: localStorage is shared across same-origin tabs, so ending a
      // support session must not wipe the PlatformSuperAdmin's own display timezone in their other tab.
      this.preferences.clear();
    }
    this.currentUserSubject.next(null);
  }

  /**
   * Rehydrates the session on app start. The cached user is a display convenience;
   * the API re-authorizes every request, so a stale cache cannot grant access.
   *
   * A missing refresh token is only tolerated when the access token is itself an impersonation
   * token (carries `impersonated_by` — see beginImpersonationSession) — that is the one case where
   * having no refresh token is by design, not a corrupt/tampered session.
   */
  private restoreSession(): void {
    const claims = this.tokens.decodeAccessToken();
    const isImpersonation = !!claims && !!readAccessTokenClaims(claims).impersonatedByUserId;

    if (!this.tokens.accessToken || (!this.tokens.refreshToken && !isImpersonation)) {
      this.clearSession();
      return;
    }

    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      try {
        this.currentUserSubject.next(JSON.parse(cached) as User);
        return;
      } catch {
        // fall through to claim-derived user
      }
    }

    if (!claims) {
      this.clearSession();
      return;
    }

    const derived = readAccessTokenClaims(claims);
    this.currentUserSubject.next({
      id: derived.id,
      fullName: derived.name,
      email: derived.email,
      phoneNumber: null,
      isActive: true,
      roles: derived.roles,
      createdAt: '',
      lastLoginAt: null,
    });
  }
}
