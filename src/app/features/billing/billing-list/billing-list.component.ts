import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { BillingService } from '../../../core/services/billing.service';
import { Payment, Plan, Subscription } from '../../../core/models/billing.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/**
 * Tenant-facing billing (SaaS conversion Phase D): the plan catalog, the tenant's current
 * subscription and payment history, and the plan-picker that switches it. Payments are simulated
 * for now — see BillingService's own doc comment (Stripe pulled out for this platform's
 * India-first launch, Razorpay not wired in yet) — so choosing a plan takes effect immediately
 * rather than redirecting anywhere; this screen never collects card details, real or otherwise.
 */
@Component({
  selector: 'app-billing-list',
  templateUrl: './billing-list.component.html',
  styleUrls: ['./billing-list.component.scss'],
})
export class BillingListComponent implements OnInit {
  loadingPlans = true;
  loadingSubscription = true;
  loadingPayments = true;
  switchingPlanId: string | null = null;

  plans: Plan[] = [];
  subscription: Subscription | null = null;
  paymentHistory: Payment[] = [];

  constructor(
    private readonly billing: BillingService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadSubscription();
    this.loadPaymentHistory();
  }

  isCurrentPlan(plan: Plan): boolean {
    return !!this.subscription && this.subscription.planId === plan.id;
  }

  /** Shows the plan's localized quote (currencySymbol/localPriceAmount, resolved server-side from
   * this tenant's own country — see Plan's own doc comment). */
  formatPrice(plan: Plan): string {
    return `${this.formatAmount(plan.currencySymbol, plan.localPriceAmount)}/mo`;
  }

  formatPayment(payment: Payment): string {
    return this.formatAmount(payment.currencySymbol, payment.localAmount);
  }

  choosePlan(plan: Plan): void {
    if (this.switchingPlanId || this.isCurrentPlan(plan)) {
      return;
    }

    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Switch to ${plan.name}?`,
          message: `This takes effect immediately, at ${this.formatPrice(plan)}.`,
          confirmLabel: 'Switch plan',
        } as ConfirmDialogData,
        width: '460px',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.switchingPlanId = plan.id;
        this.billing
          .choosePlan(plan.id)
          .pipe(finalize(() => (this.switchingPlanId = null)))
          .subscribe({
            next: (subscription) => {
              this.subscription = subscription;
              this.notify.success(`Switched to ${plan.name}.`);
              this.loadPaymentHistory();
            },
          });
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

  private loadSubscription(): void {
    this.loadingSubscription = true;
    this.billing.getSubscription().subscribe({
      next: (subscription) => {
        this.subscription = subscription;
        this.loadingSubscription = false;
      },
      error: () => (this.loadingSubscription = false),
    });
  }

  private loadPaymentHistory(): void {
    this.loadingPayments = true;
    this.billing.getPaymentHistory().subscribe({
      next: (payments) => {
        this.paymentHistory = payments;
        this.loadingPayments = false;
      },
      error: () => (this.loadingPayments = false),
    });
  }

  private formatAmount(symbol: string, amount: number): string {
    const decimals = Number.isInteger(amount) ? 0 : 2;
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  }
}
