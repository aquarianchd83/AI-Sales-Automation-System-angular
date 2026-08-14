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
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  store(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clear(): void {
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
