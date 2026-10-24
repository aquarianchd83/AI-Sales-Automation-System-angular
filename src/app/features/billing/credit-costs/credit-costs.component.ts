import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { formatUnits } from '../../../core/models/billing.model';
import { FeatureCost, FeatureWallet, PLATFORM_FEATURE_ICONS, PlatformFeature, WalletSummary, creditsLabel } from '../../../core/models/wallet.model';
import { BillingService } from '../../../core/services/billing.service';

/**
 * Credit costs: every action that spends credits, grouped by feature, with the price the platform set - one place to see what anything costs before
 * doing it. The estimator multiplies a quantity by each price so a campaign or a discovery run can be costed against the balance first.
 */
@Component({
  selector: 'app-credit-costs',
  templateUrl: './credit-costs.component.html',
  styleUrls: ['./credit-costs.component.scss'],
})
export class CreditCostsComponent implements OnInit {
  readonly creditsLabel = creditsLabel;
  readonly formatUnits = formatUnits;

  summary: WalletSummary | null = null;
  loading = true;
  /** How many of each action the tenant is costing out, by scenario. */
  readonly quantities = new Map<number, number>();

  constructor(private readonly billing: BillingService) {}

  ngOnInit(): void {
    this.billing
      .getWallet()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (summary) => (this.summary = summary) });
  }

  featureIcon(feature: PlatformFeature): string {
    return PLATFORM_FEATURE_ICONS[feature];
  }

  quantityOf(cost: FeatureCost): number | null {
    return this.quantities.has(cost.scenario) ? this.quantities.get(cost.scenario)! : null;
  }

  setQuantity(cost: FeatureCost, value: string): void {
    const parsed = Number(value);
    if (value === '' || Number.isNaN(parsed) || parsed <= 0) {
      this.quantities.delete(cost.scenario);
      return;
    }
    this.quantities.set(cost.scenario, parsed);
  }

  /** What the typed quantity of one action comes to. */
  lineTotal(cost: FeatureCost): number {
    return (this.quantities.get(cost.scenario) ?? 0) * cost.credits;
  }

  get estimate(): number {
    return (this.summary?.features ?? []).filter((f) => f.includedInPlan).reduce((sum, f) => sum + f.costs.reduce((s, c) => s + this.lineTotal(c), 0), 0);
  }

  get estimating(): boolean {
    return this.quantities.size > 0;
  }

  get shortfall(): number {
    return Math.max(0, this.estimate - (this.summary?.balance ?? 0));
  }

  isFree(cost: FeatureCost): boolean {
    return cost.credits === 0;
  }

  trackFeature(_: number, feature: FeatureWallet): PlatformFeature {
    return feature.feature;
  }
}
