import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { BillingService } from '../../../core/services/billing.service';
import { Plan, Subscription } from '../../../core/models/billing.model';

/**
 * Tenant-facing billing (SaaS conversion Phase D): the plan catalog, the tenant's current
 * subscription, and the two buttons that hand off to Stripe's own hosted pages (Checkout, the
 * Customer Portal) — this screen never collects card details itself.
 */
@Component({
  selector: 'app-billing-list',
  templateUrl: './billing-list.component.html',
  styleUrls: ['./billing-list.component.scss'],
})
export class BillingListComponent implements OnInit {
  loadingPlans = true;
  loadingSubscription = true;
  startingCheckoutForPlanId: string | null = null;
  openingPortal = false;

  plans: Plan[] = [];
  subscription: Subscription | null = null;

  constructor(
    private readonly billing: BillingService,
    private readonly notify: NotificationService,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadPlans();
    this.loadSubscription();
    this.announceCheckoutOutcome();
  }

  /** True once the tenant has a Subscription row at all — a Stripe Customer exists, so the
   * Billing Portal button can be shown (see IBillingService.CreateBillingPortalSessionAsync's own
   * "complete Checkout first" requirement). */
  get hasBillingPortalAccess(): boolean {
    return this.subscription !== null;
  }

  isCurrentPlan(plan: Plan): boolean {
    return !!this.subscription && this.subscription.planId === plan.id;
  }

  formatPrice(priceMonthlyCents: number): string {
    return `$${(priceMonthlyCents / 100).toFixed(priceMonthlyCents % 100 === 0 ? 0 : 2)}/mo`;
  }

  choosePlan(plan: Plan): void {
    if (this.startingCheckoutForPlanId) {
      return;
    }

    this.startingCheckoutForPlanId = plan.id;
    const returnUrl = this.currentUrlWithoutQuery();
    this.billing
      .createCheckoutSession({
        planId: plan.id,
        successUrl: `${returnUrl}?checkout=success`,
        cancelUrl: `${returnUrl}?checkout=cancelled`,
      })
      .pipe(finalize(() => (this.startingCheckoutForPlanId = null)))
      .subscribe({
        // A full navigation, not routerLink — Stripe Checkout is a page this app does not own.
        next: (session) => (window.location.href = session.url),
      });
  }

  openBillingPortal(): void {
    if (this.openingPortal) {
      return;
    }

    this.openingPortal = true;
    this.billing
      .createBillingPortalSession({ returnUrl: this.currentUrlWithoutQuery() })
      .pipe(finalize(() => (this.openingPortal = false)))
      .subscribe({
        next: (session) => (window.location.href = session.url),
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

  /**
   * checkout=success/cancelled only means Checkout itself finished/was abandoned — activation is
   * driven by Stripe's webhook (StripeWebhookHandler), which may land a beat after this redirect,
   * so the message is deliberately hedged rather than claiming the plan is active yet.
   */
  private announceCheckoutOutcome(): void {
    const checkout = this.route.snapshot.queryParamMap.get('checkout');
    if (checkout === 'success') {
      this.notify.success('Payment received — your plan will update shortly.');
    } else if (checkout === 'cancelled') {
      this.notify.info('Checkout was cancelled. No changes were made.');
    }
  }

  private currentUrlWithoutQuery(): string {
    return `${window.location.origin}${window.location.pathname}`;
  }
}
