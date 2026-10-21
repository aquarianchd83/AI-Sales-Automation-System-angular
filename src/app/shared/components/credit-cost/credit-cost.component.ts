import { Component, Input } from '@angular/core';

import { CreditScenario } from '../../../core/models/credit-payer.model';
import { CreditCostItem, creditsLabel } from '../../../core/models/wallet.model';
import { EntitlementsStore } from '../../../core/services/entitlements.store';

/**
 * The placeholder every feature shows for what using it costs: "Uses 2 credits per reply". The credits are the platform admin's price for the
 * action (Credit costs), read from what the tenant's plan includes - so it is the real number, not a guess. While it is not known it says "Uses credits".
 *
 * `scenario` names one action; `scenarios` lists several (e.g. a feature with a generation step and a render step), shown side by side.
 */
@Component({
  selector: 'app-credit-cost',
  template: `
    <span class="credit-cost" data-testid="credit-cost" [attr.title]="'Taken from your credit balance'">
      <mat-icon class="credit-cost__icon" aria-hidden="true">toll</mat-icon>
      <span>{{ text }}</span>
    </span>
  `,
  styles: [
    `
      .credit-cost {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 10px 2px 6px;
        border-radius: 12px;
        background: #fff8e1;
        color: #6d4c00;
        font-size: 12px;
        line-height: 20px;
        white-space: nowrap;
      }
      .credit-cost__icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class CreditCostComponent {
  @Input() scenario: CreditScenario | null = null;
  @Input() scenarios: CreditScenario[] = [];
  /** Words before the cost; "Uses" by default. */
  @Input() prefix = 'Uses';

  constructor(private readonly entitlements: EntitlementsStore) {}

  get text(): string {
    const wanted = this.scenario !== null ? [this.scenario, ...this.scenarios] : this.scenarios;
    const costs = wanted.map((s) => this.entitlements.costOf(s)).filter((c): c is CreditCostItem => c !== null);
    if (!costs.length) {
      return `${this.prefix} credits`;
    }
    return `${this.prefix} ${costs.map((c) => `${creditsLabel(c.credits)} per ${c.unitLabel}`).join(' · ')}`;
  }
}
