import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';

import { QUOTA_TYPE_LABELS, QuotaType, formatUnits } from '../../../core/models/billing.model';
import { PlatformCreditPack, PlatformPlan } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformCreditPackFormDialogComponent } from '../platform-credit-pack-form-dialog/platform-credit-pack-form-dialog.component';

@Component({
  selector: 'app-platform-billing',
  templateUrl: './platform-billing.component.html',
  styleUrls: ['./platform-billing.component.scss'],
})
export class PlatformBillingComponent implements OnInit {
  readonly packColumns = ['name', 'type', 'units', 'price', 'status', 'actions'];
  readonly formatUnits = formatUnits;

  plans: PlatformPlan[] = [];
  loadingPlans = true;

  packs: PlatformCreditPack[] = [];
  loadingPacks = true;

  constructor(
    private readonly billing: PlatformBillingService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadPacks();

  }

  /** Shown in the operator's own currency (from their profile country); the catalog itself is still
   * authored in USD, which is what the add/edit dialog writes. */
  formatPrice(plan: PlatformPlan): string {
    if (!plan.priceMonthlyLocal) {
      return 'Not sold in India';
    }
    const whole = Number.isInteger(plan.priceMonthlyLocal);
    return `${plan.currencySymbol}${plan.priceMonthlyLocal.toFixed(whole ? 0 : 2)}/mo`;
  }

  /** The authored figure, for the card's secondary line — so an operator editing the plan knows what the
   * dialog will show them. Omitted when the operator is already on USD. */
  formatBasePrice(plan: PlatformPlan): string | null {
    if (plan.currencyCode === 'USD') {
      return null;
    }
    const usd = plan.priceMonthlyCents / 100;
    return `$${usd.toFixed(usd % 1 === 0 ? 0 : 2)} USD`;
  }

  quotaLabel(type: QuotaType): string {
    return QUOTA_TYPE_LABELS[type];
  }

  formatPackPrice(pack: PlatformCreditPack): string {
    if (!pack.priceLocal) {
      return 'Not sold in India';
    }
    return `${pack.currencySymbol}${pack.priceLocal.toFixed(Number.isInteger(pack.priceLocal) ? 0 : 2)}`;
  }

  addPack(): void {
    this.openPackDialog(null);
  }

  editPack(pack: PlatformCreditPack): void {
    this.openPackDialog(pack);
  }

  retirePack(pack: PlatformCreditPack): void {
    const data: ConfirmDialogData = {
      title: 'Retire this credit pack?',
      message: `${pack.name} will stop being offered. Credits tenants already bought from it are unaffected.`,
      confirmLabel: 'Retire',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.billing.deleteCreditPack(pack.id).subscribe({
          next: () => {
            this.notify.success('Credit pack retired.');
            this.loadPacks();
          },
        });
      });
  }

  /** Plans are created and edited on their own page, which shows what the plan will cost to serve. */
  addPlan(): void {
    this.router.navigate(['/platform/billing/plans/new']);
  }

  editPlan(plan: PlatformPlan): void {
    this.router.navigate(['/platform/billing/plans', plan.id]);
  }

  deletePlan(plan: PlatformPlan): void {
    const data: ConfirmDialogData = {
      title: 'Retire this plan?',
      message: `${plan.name} will no longer be offered to new or upgrading tenants. Existing subscribers keep their current limits — this never deletes the plan outright.`,
      confirmLabel: 'Retire',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.billing.deletePlan(plan.id).subscribe({
          next: () => {
            this.notify.success('Plan retired.');
            this.loadPlans();
          },
        });
      });
  }

  private openPackDialog(pack: PlatformCreditPack | null): void {
    this.dialog
      .open(PlatformCreditPackFormDialogComponent, { data: { pack }, width: '720px', maxWidth: '95vw', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.loadPacks();
        }
      });
  }

  private loadPacks(): void {
    this.loadingPacks = true;
    this.billing.getCreditPacks().subscribe({
      next: (packs) => {
        this.packs = packs;
        this.loadingPacks = false;
      },
      error: () => (this.loadingPacks = false),
    });
  }

  private loadPlans(): void {
    this.loadingPlans = true;
    this.billing.getPlans().subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loadingPlans = false;
      },
      error: () => (this.loadingPlans = false),
    });
  }
}
