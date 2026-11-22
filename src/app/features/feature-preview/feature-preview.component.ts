import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { STUDIO_CONTENT_ROLES } from '../../core/models/content-studio.model';
import { FEATURE_PREVIEWS, FeaturePreview, featureFromSlug } from '../../core/models/feature-preview.model';
import { TENANT_ADMIN_ROLES } from '../../core/models/user.model';
import { FeatureCost, PlatformFeature, creditsLabel } from '../../core/models/wallet.model';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { EntitlementsStore } from '../../core/services/entitlements.store';

/**
 * The preview of a feature the tenant's plan lacks: what it does, three benefits, what it costs in credits and three pictures. The sidenav's locked
 * entries and the dashboard's "Unlock more" cards open it, and featureGuard sends a locked screen here. It renders inside the shell like any page.
 *
 * Only an Admin can change the plan, so only an Admin gets the upgrade button; anyone else is told to ask their admin (there is no request to send).
 * The credit line uses the platform's own prices from the wallet (the Credit cap page's data), which only an Admin may read - nobody else sees numbers.
 */
@Component({
  selector: 'app-feature-preview',
  templateUrl: './feature-preview.component.html',
  styleUrls: ['./feature-preview.component.scss'],
})
export class FeaturePreviewComponent implements OnInit, OnDestroy {
  readonly isAdmin = this.auth.hasAnyRole(TENANT_ADMIN_ROLES);

  preview: FeaturePreview | null = null;
  /** The feature's priced actions, for an Admin; null until read (or when they could not be). */
  costs: FeatureCost[] | null = null;

  private readonly destroy$ = new Subject<void>();
  /** The costs request for the feature on screen; a newer preview cancels it so an older answer cannot land on it. */
  private costsRequest: Subscription | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsStore
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const feature = featureFromSlug(params.get('feature'));
      if (!feature) {
        this.router.navigateByUrl('/dashboard');
        return;
      }
      this.preview = FEATURE_PREVIEWS[feature];
      this.costs = null;
      this.costsRequest?.unsubscribe();
      if (this.isAdmin) {
        this.loadCosts(feature);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** True once the plan is known to include the feature - e.g. right after an upgrade, or from an old link. */
  get included(): boolean {
    return !!this.preview && this.entitlements.current !== null && this.entitlements.has(this.preview.feature);
  }

  /** Where the feature's own screen is, for a tenant whose plan includes it; null when this user has no screen for it. */
  get openRoute(): string | null {
    switch (this.preview?.feature) {
      case 'WhatsAppMessaging':
        return '/message-templates';
      case 'Campaigns':
        return '/campaigns';
      case 'AiConversations':
        return '/conversations';
      case 'LeadDiscovery':
        return this.isAdmin ? '/lead-discovery/history' : '/lead-discovery';
      case 'ContentStudio':
        return this.auth.hasAnyRole(STUDIO_CONTENT_ROLES) ? '/content-studio/stories' : null;
      case 'ProductKnowledge':
        return this.isAdmin ? '/product-knowledge/sources' : null;
      default:
        return null;
    }
  }

  /** "Uses 2 credits per reply · Free per message", from the platform's prices. Null while unknown, so nothing is guessed. */
  get creditLine(): string | null {
    if (!this.costs?.length) {
      return null;
    }
    return 'Uses ' + this.costs.map((c) => (c.credits === 0 ? `no credits per ${c.unitLabel}` : `${creditsLabel(c.credits)} per ${c.unitLabel}`)).join(' · ');
  }

  private loadCosts(feature: PlatformFeature): void {
    this.costsRequest?.unsubscribe();
    this.costsRequest = this.billing
      .getWallet()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => (this.costs = summary.features.find((f) => f.feature === feature)?.costs ?? []),
        // The page still says what the feature does; the costs stay on the Credit cap page.
        error: () => (this.costs = []),
      });
  }
}
