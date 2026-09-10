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
    private readonly router: Router
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
   * Callers must only do this in a fresh browser tab (see ImpersonationSessionService) — loading an
   * impersonation token into the tab a PlatformSuperAdmin is already signed in on would silently
   * replace their own session.
   */
  beginImpersonationSession(accessToken: string): void {
    this.tokens.store(accessToken, '');
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
    localStorage.setItem(USER_KEY, JSON.stringify(user));
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
    this.tokens.clear();
    localStorage.removeItem(USER_KEY);
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
