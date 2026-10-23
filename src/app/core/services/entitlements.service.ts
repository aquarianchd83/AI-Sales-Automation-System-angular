import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { PLATFORM_ADMIN_ROLES } from '../models/platform.model';
import { Entitlements, PlatformFeature } from '../models/wallet.model';
import { AuthService } from './auth.service';
import { BillingService } from './billing.service';
import { EntitlementsStore } from './entitlements.store';

/**
 * Loads what the signed-in tenant may use and what each action costs (into the {@link EntitlementsStore}) - the one place the app asks "is this feature in
 * my plan?". A feature outside the plan is hidden from the menu, its screens are guarded, and the API refuses it anyway, so this is for the experience,
 * never the only control.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementsService {
  private inFlight: Observable<Entitlements | null> | null = null;

  readonly entitlements$ = this.store.entitlements$;

  constructor(
    private readonly billing: BillingService,
    private readonly auth: AuthService,
    private readonly store: EntitlementsStore
  ) {
    // A new session starts from nothing.
    this.auth.currentUser$.subscribe((user) => {
      if (!user) {
        this.clear();
      }
    });
  }

  get current(): Entitlements | null {
    return this.store.current;
  }

  /** Whether the feature is in the tenant's plan. True while not known, and always for a platform admin. */
  has(feature: PlatformFeature): boolean {
    return this.store.has(feature);
  }

  /** Loads the entitlements (once; later callers share the answer) - or asks again with `force`, e.g. after a purchase or a plan change. */
  load(force = false): Observable<Entitlements | null> {
    // A platform admin belongs to no tenant, so there is no plan to read - and nothing to hide.
    this.store.unrestricted = this.auth.hasAnyRole(PLATFORM_ADMIN_ROLES);
    if (this.store.unrestricted || !this.auth.isAuthenticated) {
      return of(null);
    }
    if (!force && this.store.current) {
      return of(this.store.current);
    }
    if (!this.inFlight) {
      this.inFlight = this.billing.getEntitlements().pipe(
        tap((e) => this.store.set(e)),
        map((e): Entitlements | null => e),
        catchError(() => of(this.store.current)),
        tap(() => (this.inFlight = null))
      );
    }
    return this.inFlight;
  }

  clear(): void {
    this.store.clear();
    this.store.unrestricted = false;
    this.inFlight = null;
  }
}
