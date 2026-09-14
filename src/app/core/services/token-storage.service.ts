import { Injectable } from '@angular/core';

import { AccessTokenClaims } from '../models/auth.model';

const ACCESS_TOKEN_KEY = 'wsa.accessToken';
const REFRESH_TOKEN_KEY = 'wsa.refreshToken';

/**
 * Persists the token pair in localStorage so a page refresh keeps the session.
 *
 * Trade-off, called out deliberately: localStorage is readable by any script on the
 * origin, so a stored access token is XSS-exposed. The alternative — an HttpOnly
 * refresh-token cookie — needs backend cookie support that Phase 2 does not implement
 * (the API returns both tokens in the JSON body). Swap this service's internals when
 * the API moves to cookie-based refresh; nothing else in the app touches storage.
 *
 * One deliberate exception to "everything lives in localStorage": an impersonation
 * (Platform Admin Console support session) access token — see storeImpersonation()'s own
 * doc comment for why it's kept in memory instead, never written to the shared store.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  /** Set only by storeImpersonation() — this tab's support-session token, isolated from
   * localStorage on purpose. Null for an ordinary (non-impersonation) tab. */
  private impersonationAccessToken: string | null = null;

  get accessToken(): string | null {
    return this.impersonationAccessToken ?? localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    // An impersonation session never has a refresh token at all (see
    // AuthService.beginImpersonationSession's own doc comment) - short-circuiting here means
    // storeImpersonation()/clear() below never need to touch this tab's actual localStorage
    // refresh-token entry either, which is what keeps a support-session tab from ever
    // overwriting (or later clearing) the operator's own tab's shared session.
    if (this.impersonationAccessToken) {
      return null;
    }
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  store(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  /**
   * Loads an impersonation access token as in-memory, per-tab state only — deliberately never
   * written to localStorage. localStorage is shared by every same-origin tab, including the
   * PlatformSuperAdmin's own Platform Admin Console tab that opened this one (see
   * ImpersonationSessionService) — writing the support token there would silently replace the
   * operator's own access token (and blank out their refresh token) on their original tab too,
   * and later clearing it (when the support session ends) would then log the operator out of
   * their own session as a side effect. An in-memory field is scoped to this tab's own JS
   * runtime, which browser tabs never share, so neither failure mode is reachable.
   */
  storeImpersonation(accessToken: string): void {
    this.impersonationAccessToken = accessToken;
  }

  clear(): void {
    if (this.impersonationAccessToken) {
      this.impersonationAccessToken = null;
      return;
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  /** Decodes the JWT payload without verifying it — display/routing hints only. */
  decodeAccessToken(token = this.accessToken): AccessTokenClaims | null {
    if (!token) {
      return null;
    }
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    try {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '='
      );
      const json = decodeURIComponent(
        atob(padded)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(json) as AccessTokenClaims;
    } catch {
      return null;
    }
  }

  /** True when there is no token, or its `exp` claim is in the past. */
  isAccessTokenExpired(leewaySeconds = 0): boolean {
    const claims = this.decodeAccessToken();
    if (!claims?.exp) {
      // No token at all, or a token with no expiry we can read — treat as usable
      // only when a token exists; the API is the real authority either way.
      return !this.accessToken;
    }
    return claims.exp * 1000 <= Date.now() + leewaySeconds * 1000;
  }
}
