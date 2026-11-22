import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, Optional, Injector } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subscription as RxSubscription, timer } from 'rxjs';
import { finalize, switchMap, take, takeWhile } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { PLATFORM_FEATURE_LABELS } from '../../../core/models/wallet.model';
import { BillingService } from '../../../core/services/billing.service';
import { EntitlementsService } from '../../../core/services/entitlements.service';
import { EMBEDDED_IN_ONBOARDING } from '../../../core/tokens/embedded-in-onboarding';
import {
  AUTOPAY_STATUS_LABELS,
  AutoPayAvailability,
  AutoPayInvoice,
  AutoPayStatus,
  AutoPaySubscription,
  Payment,
  Plan,
  QuotaGrantOrigin,
  QuotaType,
  REFUND_STATUS_LABELS,
  RefundRequest,
  RefundStatus,
  Subscription,
  autoPayIsRunning,
  autoPayIsWaiting,
  formatUnits,
  taxBreakdown,
} from '../../../core/models/billing.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { RefundRequestDialogComponent } from '../refund-request-dialog/refund-request-dialog.component';

/**
 * Tenant-facing billing (SaaS conversion Phase D): the plan catalog, the tenant's current
 * subscription and payment history, and the plan-picker that switches it.
 *
 * A paid plan is bought one of two ways, and the server says which (getAutoPayAvailability):
 * - UPI AutoPay: Subscribe starts a Razorpay mandate and sends the tenant to Razorpay to approve it in their UPI app.
 *   Coming back from there proves nothing - this screen only ever shows what the server reports, and the server takes
 *   it from Razorpay. The plan starts when Razorpay confirms the first payment, not when the tenant returns.
 * - Otherwise the older simulated path: choosing a plan takes effect immediately.
 * Either way this screen never collects payment details.
 */
@Component({
  selector: 'app-billing-list',
  templateUrl: './billing-list.component.html',
  styleUrls: ['./billing-list.component.scss'],
})
export class BillingListComponent implements OnInit, OnDestroy {
  loadingPlans = true;
  loadingSubscription = true;
  loadingPayments = true;
  switchingPlanId: string | null = null;

  plans: Plan[] = [];
  subscription: Subscription | null = null;
  /** The free trial's included units per quota type; empty until loaded, or when the trial grants nothing. */
  trialAllowance: { quotaType: QuotaType; units: number }[] = [];
  paymentHistory: Payment[] = [];

  /** Both histories open with this many rows; the rest are revealed as the tenant scrolls to the bottom. */
  static readonly pageSize = 10;
  paymentsShown = BillingListComponent.pageSize;
  refundsShown = BillingListComponent.pageSize;

  /** Whether a paid plan is bought through UPI AutoPay. Null until the server has said; treated as "no" until then. */
  autoPay: AutoPayAvailability | null = null;
  /** The tenant's AutoPay mandate, as the server last reported it. Null when there has never been one. */
  mandate: AutoPaySubscription | null = null;
  startingCheckoutPlanId: string | null = null;
  checkingMandate = false;
  cancellingMandate = false;
  /** Null until asked for; loaded on demand, since they are read from Razorpay each time. */
  invoices: AutoPayInvoice[] | null = null;
  loadingInvoices = false;
  readonly autoPayStatusLabels = AUTOPAY_STATUS_LABELS;

  /** How often, and for how long, the server is asked again while a mandate is on its way to being confirmed. */
  static readonly pollEveryMs = 5000;
  static readonly pollTimes = 36;
  private polling: RxSubscription | null = null;
  /** Whether the server has already been asked, on this visit, to put a paid mandate's plan back on the subscription. */
  private planSyncAsked = false;

  /** Whether the platform operator has switched refund requests on for this tenant - no button without it. */
  refundsEnabled = false;
  refundRequests: RefundRequest[] = [];

  get visiblePayments(): Payment[] {
    return this.paymentHistory.slice(0, this.paymentsShown);
  }

  get visibleRefunds(): RefundRequest[] {
    return this.refundRequests.slice(0, this.refundsShown);
  }

  showMorePayments(): void {
    this.paymentsShown += BillingListComponent.pageSize;
  }

  showMoreRefunds(): void {
    this.refundsShown += BillingListComponent.pageSize;
  }
  readonly RefundStatus = RefundStatus;
  readonly featureLabels = PLATFORM_FEATURE_LABELS;
  readonly formatUnits = formatUnits;

  constructor(
    private readonly billing: BillingService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog,
    private readonly injector: Injector,
    @Optional() @Inject(EMBEDDED_IN_ONBOARDING) embedded: boolean | null,
    @Inject(DOCUMENT) private readonly document: Document
  ) {
    this.embedded = !!embedded;
  }

  /** Shown inside the onboarding step "Select Package Plan": just the plans. Payment history, refund requests and the
   * shortcut to usage and credits belong to the Billing page, not to choosing a plan - and are neither shown nor fetched. */
  readonly embedded: boolean;

  ngOnInit(): void {
    this.loadPlans();
    this.loadSubscription();
    this.loadTrialAllowance();
    this.loadPaymentHistory();
    this.billing.getCapabilities().subscribe({
      next: (capabilities) => {
        this.refundsEnabled = capabilities.refundRequestsEnabled;
      },
    });
    this.loadRefundRequests();
    this.loadAutoPay();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  isCurrentPlan(plan: Plan): boolean {
    return !!this.subscription && this.subscription.planId === plan.id;
  }

  /**
   * What moving to this plan means for the tenant, by price: dearer is an upgrade, cheaper a downgrade. A tenant with no
   * subscription is simply choosing. A current plan that is not on the list (a free one is never sold) counts as free,
   * so everything listed is an upgrade from it.
   */
  changeKind(plan: Plan): 'upgrade' | 'downgrade' | 'choose' {
    if (!this.subscription?.planId) {
      return 'choose';
    }
    const current = this.plans.find((p) => p.id === this.subscription!.planId);
    const currentPrice = current?.localPriceAmount ?? 0;
    if (plan.localPriceAmount > currentPrice) {
      return 'upgrade';
    }
    return plan.localPriceAmount < currentPrice ? 'downgrade' : 'choose';
  }

  /** A paid plan, where the server says paid plans are bought through AutoPay. */
  usesAutoPay(plan: Plan): boolean {
    return !!this.autoPay?.available && (plan.totalLocal || plan.localPriceAmount) > 0;
  }

  /** A mandate that is authorised and not finished: a second cannot be started beside it, and the plan cannot be switched under it. */
  get mandateRunning(): boolean {
    return !!this.mandate && autoPayIsRunning(this.mandate.status);
  }

  get mandateWaiting(): boolean {
    return !!this.mandate && autoPayIsWaiting(this.mandate.status);
  }

  /** Whether this plan's button can do anything right now. */
  planButtonDisabled(plan: Plan): boolean {
    if (this.isCurrentPlan(plan) || !!this.switchingPlanId || !!this.startingCheckoutPlanId) {
      return true;
    }
    // While a mandate is charging, the plan is changed by cancelling it first - the server refuses anything else.
    return this.mandateRunning;
  }

  planButtonLabel(plan: Plan): string {
    if (this.isCurrentPlan(plan)) {
      return 'Current plan';
    }
    if (this.switchingPlanId === plan.id) {
      return 'Switching…';
    }
    if (this.startingCheckoutPlanId === plan.id) {
      return 'Starting…';
    }
    if (this.usesAutoPay(plan)) {
      return this.mandate?.status === 'PendingAuthorization' && this.mandate.planId === plan.id ? 'Continue to authorize' : 'Subscribe now';
    }
    return this.actionLabel(plan);
  }

  actionLabel(plan: Plan): string {
    switch (this.changeKind(plan)) {
      case 'upgrade':
        return 'Upgrade';
      case 'downgrade':
        return 'Downgrade';
      default:
        return 'Choose plan';
    }
  }

  /** Shows the plan's localized quote (currencySymbol/localPriceAmount, resolved server-side from
   * this tenant's own country — see Plan's own doc comment). */
  formatPrice(plan: Plan): string {
    if (!plan.localPriceAmount) {
      return 'Free';
    }
    return `${this.formatAmount(plan.currencySymbol, plan.localPriceAmount)}/mo`;
  }

  /** "+ GST 18% ₹179.82 = ₹1,178.82/mo" - the tax added on top, spelled out, and what will be charged. Empty with no tax. */
  taxLine(plan: Plan): string {
    if (!plan.taxLocal) {
      return '';
    }
    return `+ ${taxBreakdown(plan.taxLines, plan.currencySymbol)} = ${this.formatAmount(plan.currencySymbol, plan.totalLocal)}/mo`;
  }

  /** What the tenant actually paid: the total including tax. Payments from before tax was recorded show their price. */
  formatPayment(payment: Payment): string {
    const paid = payment.totalLocal ? payment.totalLocal : payment.localAmount;
    // A refund row carries negative amounts - the sign belongs in front of the symbol, not after it.
    const formatted = this.formatAmount(payment.currencySymbol, Math.abs(paid));
    return paid < 0 ? `−${formatted}` : formatted;
  }

  /** "incl. GST 18% ₹179.82" under a payment. */
  paymentTax(payment: Payment): string {
    return payment.taxLocal ? `incl. ${taxBreakdown(payment.taxLines, payment.currencySymbol)}` : '';
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
    // Nothing was paid on a failed attempt; and a Razorpay payment is not refunded from here (the server refuses both).
    if (this.paymentFailed(payment) || payment.provider === 'Razorpay') {
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
    if (this.switchingPlanId || this.startingCheckoutPlanId || this.isCurrentPlan(plan)) {
      return;
    }

    if (this.usesAutoPay(plan)) {
      this.subscribe(plan);
      return;
    }

    const kind = this.changeKind(plan);
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `${kind === 'upgrade' ? 'Upgrade' : kind === 'downgrade' ? 'Downgrade' : 'Switch'} to ${plan.name}?`,
          message:
            kind === 'downgrade'
              ? `This takes effect immediately, at ${this.formatPrice(plan)}. Anything ${plan.name} does not include will no longer be available to you.`
              : `This takes effect immediately, at ${this.formatPrice(plan)}.`,
          confirmLabel: this.actionLabel(plan),
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
              this.notify.success(`${kind === 'upgrade' ? 'Upgraded' : kind === 'downgrade' ? 'Downgraded' : 'Switched'} to ${plan.name}.`);
              this.loadPaymentHistory();
              // The plan decides what the menu shows and the wallet figure, so read both again now rather than on the next page change.
              this.injector.get(EntitlementsService).load(true).subscribe({ error: () => undefined });
            },
          });
      });
  }

  // ----- UPI AutoPay -----

  paymentFailed(payment: Payment): boolean {
    return payment.status === 'Failed';
  }

  /** "UPI · pay_Nx1..." - how it was paid and the gateway's reference, when there is one. */
  paymentReference(payment: Payment): string {
    return [payment.paymentMethod?.toUpperCase(), payment.transactionId].filter((part) => !!part).join(' · ');
  }

  mandateAmount(mandate: AutoPaySubscription): string {
    return `${this.formatAmount('₹', mandate.amount)}/month`;
  }

  /** Which of the four chip colours a status gets: green only for what the server has confirmed. */
  mandateChip(status: AutoPayStatus): 'ok' | 'waiting' | 'problem' | 'off' {
    switch (status) {
      case 'Active':
        return 'ok';
      case 'PendingAuthorization':
      case 'PaymentPending':
      case 'CancellationScheduled':
      case 'Paused':
        return 'waiting';
      case 'PastDue':
      case 'Halted':
        return 'problem';
      default:
        return 'off';
    }
  }

  /** What the tenant should know or do about the mandate right now. Empty when all is well. */
  mandateNotice(mandate: AutoPaySubscription): string {
    switch (mandate.status) {
      case 'PendingAuthorization':
        return 'Approve the mandate in your UPI app to start your plan. It is not active until Razorpay confirms it.';
      case 'PaymentPending':
        return 'The mandate is approved. Your plan starts as soon as Razorpay confirms the first payment.';
      case 'PastDue':
        return "Your last automatic payment didn't go through. It will be tried again automatically over the next few days - please make sure your UPI account has enough balance.";
      case 'Halted':
        return 'Automatic payment has stopped after several failed attempts. To keep your plan, cancel this mandate and subscribe again.';
      case 'Paused':
        return 'Automatic payment is paused, so nothing will be taken. Resume the mandate in your UPI app to keep your plan after the paid period.';
      case 'CancellationScheduled':
        return 'Automatic payment has been cancelled. Your plan stays active until the end of the period already paid for.';
      default:
        return '';
    }
  }

  /** Starts the mandate and sends the tenant to Razorpay to approve it. */
  subscribe(plan: Plan): void {
    const amount = this.formatAmount(plan.currencySymbol, plan.totalLocal || plan.localPriceAmount);
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: `Subscribe to ${plan.name}?`,
          message:
            `${amount} will be paid automatically every month by UPI AutoPay. You will be taken to Razorpay to approve the mandate in your UPI app ` +
            `(Google Pay, PhonePe, Paytm and others). Your plan starts once Razorpay confirms the first payment, and you can cancel at any time.`,
          confirmLabel: 'Continue to Razorpay',
        } as ConfirmDialogData,
        width: '480px',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.startingCheckoutPlanId = plan.id;
        this.billing
          .startAutoPayCheckout(plan.id)
          .pipe(finalize(() => (this.startingCheckoutPlanId = null)))
          .subscribe({
            next: (checkout) => {
              this.openAuthorization(checkout.authorizationUrl);
              this.notify.info('Approve the mandate on the Razorpay page. This page will update once Razorpay confirms it.');
              // What was started is read back from the server, then watched until it is confirmed or the tenant gives up.
              this.loadMandate(true);
            },
          });
      });
  }

  /** Razorpay's page opens in its own tab, so this page stays here to show the result. A blocked pop-up leaves the link on the card. */
  openAuthorization(url: string | null | undefined): void {
    if (url) {
      this.document.defaultView?.open(url, '_blank', 'noopener');
    }
  }

  /** Asks the server to ask Razorpay. The only way this screen ever learns that a mandate went through. */
  checkMandate(): void {
    if (!this.mandate || this.checkingMandate) {
      return;
    }
    this.checkingMandate = true;
    this.billing
      .refreshAutoPaySubscription(this.mandate.id)
      .pipe(finalize(() => (this.checkingMandate = false)))
      .subscribe({
        next: (mandate) => {
          const before = this.mandate?.status;
          this.applyMandate(mandate);
          if (mandate.status === before && autoPayIsWaiting(mandate.status)) {
            this.notify.info('Razorpay has not confirmed it yet.');
          }
        },
      });
  }

  cancelMandate(): void {
    const mandate = this.mandate;
    if (!mandate || this.cancellingMandate) {
      return;
    }

    // With a paid period in progress the mandate stops at its end; one never approved, or no longer paying, has no period to wait for.
    const now = mandate.status === 'PendingAuthorization' || mandate.status === 'Halted' || mandate.status === 'PastDue';
    const until = mandate.currentPeriodEndUtc ? new Date(mandate.currentPeriodEndUtc).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null;
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: mandate.status === 'PendingAuthorization' ? 'Cancel this subscription request?' : 'Cancel automatic payment?',
          message:
            mandate.status === 'PendingAuthorization'
              ? 'Nothing has been paid. The request is withdrawn and you can subscribe again whenever you like.'
              : now
              ? 'No further payments will be taken. A cancelled mandate cannot be restarted - to continue later you will subscribe again.'
              : `No further payments will be taken${until ? `, and your ${mandate.planName} plan stays active until ${until}` : ''}. A cancelled mandate cannot be restarted.`,
          confirmLabel: mandate.status === 'PendingAuthorization' ? 'Cancel request' : 'Cancel automatic payment',
          cancelLabel: 'Keep it',
          destructive: true,
        } as ConfirmDialogData,
        width: '480px',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.cancellingMandate = true;
        this.billing
          .cancelAutoPaySubscription(mandate.id, !now)
          .pipe(finalize(() => (this.cancellingMandate = false)))
          .subscribe({
            next: (updated) => {
              this.stopPolling();
              this.mandate = updated;
              this.notify.success(updated.status === 'CancellationScheduled' ? 'Automatic payment will stop at the end of the paid period.' : 'Automatic payment cancelled.');
              this.loadSubscription();
            },
          });
      });
  }

  toggleInvoices(): void {
    if (this.invoices) {
      this.invoices = null;
      return;
    }
    if (!this.mandate || this.loadingInvoices) {
      return;
    }
    this.loadingInvoices = true;
    this.billing
      .getAutoPayInvoices(this.mandate.id)
      .pipe(finalize(() => (this.loadingInvoices = false)))
      .subscribe({ next: (invoices) => (this.invoices = invoices) });
  }

  private loadAutoPay(): void {
    this.billing.getAutoPayAvailability().subscribe({
      next: (availability) => (this.autoPay = availability),
      // Not knowing is treated as "not available": the paid-plan button then takes the older path, which the server refuses when AutoPay is on.
      error: () => (this.autoPay = null),
    });
    this.loadMandate(false);
  }

  /** Reads the mandate from the server; one still on its way to being confirmed is then checked against Razorpay and watched. */
  private loadMandate(justStarted: boolean): void {
    this.billing.getAutoPaySubscription().subscribe({
      next: (mandate) => {
        this.mandate = mandate;
        this.invoices = null;
        if (mandate && autoPayIsWaiting(mandate.status)) {
          this.startPolling(justStarted);
        }
        this.syncPlanWithMandate();
      },
      error: () => undefined,
    });
  }

  /**
   * A mandate Razorpay reports as Active is one that has been paid. If the current plan is not that mandate's plan, the charge has not
   * been applied here yet (its webhook is late or never came): ask the server once to check with Razorpay, which records the payment and
   * moves the plan, then read the plan again. Waits until both the mandate and the subscription have loaded.
   */
  private syncPlanWithMandate(): void {
    const mandate = this.mandate;
    if (this.planSyncAsked || !mandate || mandate.status !== 'Active' || this.loadingSubscription) {
      return;
    }
    if (this.subscription?.planId === mandate.planId) {
      return;
    }
    this.planSyncAsked = true;
    this.billing.refreshAutoPaySubscription(mandate.id).subscribe({
      next: (fresh) => {
        this.mandate = fresh;
        this.loadSubscription();
        this.loadPaymentHistory();
        this.injector.get(EntitlementsService).load(true).subscribe({ error: () => undefined });
      },
      error: () => undefined,
    });
  }

  /** Takes a fresh report of the mandate, and when it has just been confirmed, reads again everything the new plan changes. */
  private applyMandate(mandate: AutoPaySubscription): void {
    const wasWaiting = this.mandateWaiting;
    this.mandate = mandate;
    if (!autoPayIsWaiting(mandate.status)) {
      this.stopPolling();
    }
    if (wasWaiting && mandate.status === 'Active') {
      this.notify.success(`Payment confirmed. You are on the ${mandate.planName} plan.`);
      this.loadSubscription();
      this.loadPaymentHistory();
      this.injector.get(EntitlementsService).load(true).subscribe({ error: () => undefined });
    }
  }

  /**
   * Asks the server (which asks Razorpay) every few seconds while the mandate is on its way to being confirmed, for a few minutes.
   * After that it stops quietly: the tenant may have closed Razorpay's page, and "Check status" is still there.
   * A mandate found waiting on arrival is checked once straight away; one just started is given a moment first.
   */
  private startPolling(justStarted: boolean): void {
    this.stopPolling();
    const id = this.mandate?.id;
    if (!id) {
      return;
    }
    this.polling = timer(justStarted ? BillingListComponent.pollEveryMs : 0, BillingListComponent.pollEveryMs)
      .pipe(
        take(BillingListComponent.pollTimes),
        takeWhile(() => this.mandateWaiting && this.mandate?.id === id),
        switchMap(() => this.billing.refreshAutoPaySubscription(id))
      )
      .subscribe({
        next: (mandate) => this.applyMandate(mandate),
        // Razorpay being unreachable for a moment is not the tenant's problem: stop, and leave "Check status" to them.
        error: () => this.stopPolling(),
      });
  }

  private stopPolling(): void {
    this.polling?.unsubscribe();
    this.polling = null;
  }

  private loadRefundRequests(): void {
    if (this.embedded) {
      return;
    }
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

  /** What the free trial includes, taken from the tenant's own trial grants (the platform's Trial quota, as it was
   * when this tenant signed up) - so the tenant sees exactly what they were given, not today's setting. */
  private loadTrialAllowance(): void {
    this.billing.getQuota().subscribe({
      next: (balances) => {
        this.trialAllowance = balances
          .map((b) => ({
            quotaType: b.quotaType,
            units: b.grants.filter((g) => g.origin === QuotaGrantOrigin.Trial).reduce((sum, g) => sum + g.unitsGranted, 0),
          }))
          .filter((a) => a.units > 0);
      },
      error: () => (this.trialAllowance = []),
    });
  }

  private loadSubscription(): void {
    this.loadingSubscription = true;
    this.billing.getSubscription().subscribe({
      next: (subscription) => {
        this.subscription = subscription;
        this.loadingSubscription = false;
        this.syncPlanWithMandate();
      },
      error: () => (this.loadingSubscription = false),
    });
  }

  private loadPaymentHistory(): void {
    if (this.embedded) {
      this.loadingPayments = false;
      return;
    }
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
