import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { CreditCostItem, Entitlements, PlatformFeature } from '../models/wallet.model';

/**
 * What the signed-in tenant may use and what each action costs, as last loaded - the shared state the menu, the screens and the credit placeholders read.
 * Holds no dependencies on purpose (no HTTP, no session): anything that only needs to ASK can inject this cheaply, and `EntitlementsService` is what loads it.
 *
 * Until the answer arrives (or when it cannot be read) every feature reads as available: hiding the whole menu for a moment on every page load, or
 * because one request failed, would be worse than showing a link the API then refuses with a clear message.
 */
@Injectable({ providedIn: 'root' })
export class EntitlementsStore {
  private readonly state = new BehaviorSubject<Entitlements | null>(null);

  /** True for a platform admin: no tenant, so no plan to check. */
  unrestricted = false;

  readonly entitlements$ = this.state.asObservable();

  get current(): Entitlements | null {
    return this.state.value;
  }

  set(entitlements: Entitlements | null): void {
    this.state.next(entitlements);
  }

  /** Whether the feature is in the tenant's plan. True while not known, and always when unrestricted. */
  has(feature: PlatformFeature): boolean {
    if (this.unrestricted) {
      return true;
    }
    const known = this.state.value;
    return known === null || known.features.includes(feature);
  }

  /** What one unit of the scenario costs in credits, or null when it is not known (or not in the plan). */
  costOf(scenario: number): CreditCostItem | null {
    return this.state.value?.costs.find((c) => c.scenario === scenario) ?? null;
  }

  clear(): void {
    this.state.next(null);
  }
}
