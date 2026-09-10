import { Injectable } from '@angular/core';

import { ImpersonationSession } from '../models/platform.model';

/**
 * Hands an impersonation access token off to a fresh browser tab rather than ever loading it into
 * the current one — the PlatformSuperAdmin stays signed into their own session in the tab they were
 * already on. The token travels in the URL fragment (never the query string, so it never reaches
 * server logs or `Referer` headers) to a dedicated bootstrap route that has no prior session and no
 * auth guard; see ImpersonateSessionComponent, which reads the fragment, calls
 * AuthService.beginImpersonationSession, then strips the fragment from the address bar.
 *
 * Two-step open/send, not a single `window.open` inside the HTTP response callback — a browser
 * only lets `window.open` bypass its popup blocker when it runs in the same call stack as the
 * genuine user gesture that triggered it. By the time PlatformTenantService.impersonate()'s HTTP
 * round-trip resolves, that gesture has expired: a same-tab `window.open` call there gets either
 * silently blocked or (observed in this project's own dev/preview environment) silently coerced
 * into navigating the CURRENT tab — which would replace the PlatformSuperAdmin's own session with
 * the impersonated one, exactly the failure mode this whole design exists to prevent. Opening a
 * blank placeholder tab synchronously, then sending it to the real URL once the token is ready,
 * keeps the popup reliably outside the blocker.
 */
@Injectable({ providedIn: 'root' })
export class ImpersonationSessionService {
  /** Call this FIRST, synchronously inside the click handler — before subscribing to
   * PlatformTenantService.impersonate(). Returns null if the browser blocked even this
   * synchronous open (rare, but possible with an aggressive popup blocker) — callers must check
   * for that and tell the user to allow popups rather than silently doing nothing. */
  openPlaceholder(): Window | null {
    return window.open('about:blank', '_blank');
  }

  /** Sends the already-open placeholder tab to the impersonation bootstrap route once the
   * session is ready. Returns false (without touching the current tab) if the placeholder is
   * null or the admin closed it while the request was in flight — callers should surface that as
   * "allow popups and try again," never fall back to opening it here. */
  send(placeholder: Window | null, session: ImpersonationSession): boolean {
    if (!placeholder || placeholder.closed) {
      return false;
    }
    const url = `${window.location.origin}/impersonate-session#token=${encodeURIComponent(session.accessToken)}`;
    // No 'noopener' — the placeholder tab keeps window.opener so ImpersonateSessionComponent/the
    // exit-impersonation banner can close it programmatically.
    placeholder.location.href = url;
    return true;
  }
}
