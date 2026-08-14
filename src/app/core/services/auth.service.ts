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
  RefreshTokenRequest,
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
   */
  private restoreSession(): void {
    if (!this.tokens.accessToken || !this.tokens.refreshToken) {
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

    const claims = this.tokens.decodeAccessToken();
    if (!claims) {
      this.clearSession();
      return;
    }

    const role = claims.role;
    this.currentUserSubject.next({
      id: claims.sub ?? '',
      fullName: claims.name ?? claims.email ?? '',
      email: claims.email ?? '',
      phoneNumber: null,
      isActive: true,
      roles: Array.isArray(role) ? role : role ? [role] : [],
      createdAt: '',
      lastLoginAt: null,
    });
  }
}
