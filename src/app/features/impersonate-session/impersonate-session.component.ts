import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';

/**
 * Landing page for a brand-new tab opened by ImpersonationSessionService.open(). Reads the access
 * token out of the URL fragment (never a query param — see that service's own doc comment for why),
 * loads it as the active session, then strips the fragment from the address bar before routing into
 * the app proper, so the token never lingers in browser history.
 *
 * Deliberately outside the authGuard-protected shell routes and carries no roleGuard of its own:
 * this tab starts with no session at all, and the token itself is exactly as authoritative as any
 * other access token — the API enforces the real authorization on every request that follows.
 */
@Component({
  selector: 'app-impersonate-session',
  template: `
    <div class="bootstrap">
      <mat-spinner diameter="32"></mat-spinner>
      <p>Starting support session…</p>
    </div>
  `,
  styles: [
    `
      .bootstrap {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        height: 100vh;
      }
    `,
  ],
})
export class ImpersonateSessionComponent implements OnInit {
  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');

    history.replaceState(null, '', window.location.pathname);

    if (!token) {
      void this.router.navigate(['/login']);
      return;
    }

    this.auth.beginImpersonationSession(token);
    void this.router.navigate(['/dashboard']);
  }
}
