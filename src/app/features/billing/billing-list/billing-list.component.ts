import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { BillingService } from '../../../core/services/billing.service';
import {
  Payment,
  Plan,
  QUOTA_TYPE_LABELS,
  REFUND_STATUS_LABELS,
  RefundRequest,
  RefundStatus,
  Subscription,
  formatUnits,
} from '../../../core/models/billing.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RefundRequestDialogComponent } from '../refund-request-dialog/refund-request-dialog.component';

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

  /** Whether the platform operator has switched refund requests on for this tenant - no button without it. */
  refundsEnabled = false;
  refundRequests: RefundRequest[] = [];
  readonly RefundStatus = RefundStatus;
  readonly quotaLabels = QUOTA_TYPE_LABELS;
  readonly formatUnits = formatUnits;

  constructor(
    private readonly billing: BillingService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadSubscription();
    this.loadPaymentHistory();
    this.billing.getCapabilities().subscribe({
      next: (capabilities) => {
        this.refundsEnabled = capabilities.refundRequestsEnabled;
      },
    });
    this.loadRefundRequests();
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
    // A refund row carries negative amounts - the sign belongs in front of the symbol, not after it.
    const formatted = this.formatAmount(payment.currencySymbol, Math.abs(payment.localAmount));
    return payment.localAmount < 0 ? `−${formatted}` : formatted;
  }

  refundStatusLabel(status: RefundStatus): string {
    return REFUND_STATUS_LABELS[status];
  }

  /** A payment can be refunded when it is a real charge, refunds are switched on, and nothing is already in
   * flight or done for it. The server re-checks all of this and the money rules - this only avoids a dead button. */
  canRequestRefund(payment: Payment): boolean {
    if (!this.refundsEnabled || payment.kind === 'Refund' || payment.localAmount <= 0) {
      return false;
    }
    return !this.refundRequests.some(
      (r) =>
        r.paymentId === payment.id &&
        (r.status === RefundStatus.Requested || r.status === RefundStatus.Refunded || r.status === RefundStatus.Failed)
    );
  }

  requestRefund(payment: Payment): void {
    this.dialog
      .open(RefundRequestDialogComponent, { data: { payment }, width: '520px' })
      .afterClosed()
      .subscribe((request) => {
        if (request) {
          this.notify.success("Refund request sent. We'll let you know once it has been reviewed.");
          this.loadRefundRequests();
        }
      });
  }

  cancelRefundRequest(request: RefundRequest): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Withdraw this request?',
          message: 'The credits set aside for it become available again straight away.',
          confirmLabel: 'Withdraw request',
        } as ConfirmDialogData,
        width: '460px',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.billing.cancelRefundRequest(request.id).subscribe(() => {
          this.notify.success('Request withdrawn.');
          this.loadRefundRequests();
        });
      });
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

  private loadRefundRequests(): void {
    this.billing.getRefundRequests().subscribe({ next: (requests) => (this.refundRequests = requests) });
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
