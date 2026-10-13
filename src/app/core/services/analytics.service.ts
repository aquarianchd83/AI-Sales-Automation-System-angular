import { Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { readAccessTokenClaims, JWT_CLAIM_TYPES } from '../models/auth.model';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

type Params = Record<string, string | number | boolean>;

interface AnalyticsWindow {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  clarity?: ((...args: unknown[]) => void) & { q?: unknown[] };
}

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Product analytics for the platform super admin: Google Analytics 4 (funnels, events, per-tenant
 * filtering) and Microsoft Clarity (session recordings + heatmaps, to see *why* a user is stuck).
 *
 * - Each tool loads only when its ID is set in the environment, so dev/test stay silent.
 * - Scripts are loaded as external files (the production CSP forbids inline scripts).
 * - Every page view and API failure is recorded with the user's id, role and tenant id, so a tenant
 *   user's journey can be filtered in either tool and the last screen/error before they stopped is visible.
 * - No names, emails or phone numbers are sent, and URLs are sanitised (query string dropped, ids
 *   replaced) because they can carry reset/confirmation tokens.
 * - Impersonation (support) sessions are never tracked, so operator actions do not pollute user data.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly w = window as unknown as AnalyticsWindow;
  private readonly gaId = environment.analytics?.gaMeasurementId?.trim();
  private readonly clarityId = environment.analytics?.clarityProjectId?.trim();
  private started = false;

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly tokens: TokenStorageService
  ) {}

  get enabled(): boolean {
    return !!(this.gaId || this.clarityId);
  }

  /** Call once at startup. Safe to call again; does nothing when no ID is configured. */
  init(): void {
    if (this.started || !this.enabled) {
      return;
    }
    this.started = true;

    if (this.gaId) {
      this.startGoogleAnalytics(this.gaId);
    }
    if (this.clarityId) {
      this.startClarity(this.clarityId);
    }

    this.auth.currentUser$.subscribe((user) => this.identify(user?.id ?? null, user?.roles ?? []));

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.trackPageView(e.urlAfterRedirects));
  }

  /** Records a named action, e.g. `track('campaign_created')`. */
  track(name: string, params: Params = {}): void {
    if (!this.started || this.isImpersonating()) {
      return;
    }
    this.w.gtag?.('event', name, params);
    this.w.clarity?.('event', name);
  }

  /** A failed API call: the main "why can't they proceed" signal (validation, plan limit, 403, 5xx). */
  trackApiError(method: string, url: string, status: number): void {
    const endpoint = this.sanitizePath(url);
    this.track('api_error', { method, endpoint, status });
    // Surfaces in Clarity's filters, so recordings of failing sessions are easy to find.
    if (this.started && !this.isImpersonating()) {
      this.w.clarity?.('set', 'last_error', `${status} ${method} ${endpoint}`);
    }
  }

  private trackPageView(url: string): void {
    if (this.isImpersonating()) {
      return;
    }
    const path = this.sanitizePath(url);
    this.w.gtag?.('event', 'page_view', {
      page_path: path,
      page_location: window.location.origin + path,
      page_title: document.title,
    });
    this.w.clarity?.('set', 'page', path);
  }

  private identify(userId: string | null, roles: string[]): void {
    if (!userId || this.isImpersonating()) {
      return;
    }
    const claims = this.tokens.decodeAccessToken() ?? {};
    const tenantId = (claims[JWT_CLAIM_TYPES.tenantId] as string | undefined) ?? '';
    const role = roles.join(',');
    this.w.gtag?.('config', this.gaId, { user_id: userId, send_page_view: false });
    this.w.gtag?.('set', 'user_properties', { tenant_id: tenantId, role });
    this.w.clarity?.('identify', userId);
    this.w.clarity?.('set', 'tenant_id', tenantId);
    this.w.clarity?.('set', 'role', role);
  }

  private isImpersonating(): boolean {
    return !!readAccessTokenClaims(this.tokens.decodeAccessToken() ?? {}).impersonatedByUserId;
  }

  /** Drops the origin, query string and fragment, and replaces ids with `:id`. */
  private sanitizePath(url: string): string {
    const path = url.replace(/^https?:\/\/[^/]+/i, '').split(/[?#]/)[0];
    return path.replace(GUID, ':id').replace(/\/\d+(?=\/|$)/g, '/:id') || '/';
  }

  private startGoogleAnalytics(id: string): void {
    this.w.dataLayer = this.w.dataLayer ?? [];
    this.w.gtag = function () {
      // gtag.js requires the real `arguments` object, not an array.
      // eslint-disable-next-line prefer-rest-params
      (window as unknown as AnalyticsWindow).dataLayer!.push(arguments);
    };
    this.w.gtag('js', new Date());
    this.w.gtag('config', id, { send_page_view: false });
    this.loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  }

  private startClarity(id: string): void {
    const stub = function () {
      const c = (window as unknown as AnalyticsWindow).clarity!;
      // eslint-disable-next-line prefer-rest-params
      (c.q = c.q ?? []).push(arguments);
    } as unknown as NonNullable<AnalyticsWindow['clarity']>;
    this.w.clarity = this.w.clarity ?? stub;
    this.loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(id)}`);
  }

  private loadScript(src: string): void {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }
}
