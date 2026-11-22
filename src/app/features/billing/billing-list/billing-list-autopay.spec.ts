import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, flush, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { AutoPayStatus, AutoPaySubscription, Payment, Subscription } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';
import { EntitlementsService } from '../../../core/services/entitlements.service';
import { SharedModule } from '../../../shared/shared.module';
import { BillingListComponent } from './billing-list.component';

const plan = (id: string, price: number, total = price) => ({
  id, code: id, name: id, maxUsers: 2, maxMessagesPerMonth: 0, maxCampaigns: 2, maxKnowledgeBaseArticles: 20,
  maxLeadDiscoveryBatchSize: 25, priceMonthlyCents: price * 10, currencyCode: 'INR', currencySymbol: '₹',
  localPriceAmount: price, taxLines: [], taxLocal: total - price, totalLocal: total, starterCredits: 0, monthlyCredits: 100, features: [],
});

const mandate = (status: AutoPayStatus, overrides: Partial<AutoPaySubscription> = {}): AutoPaySubscription => ({
  id: 'm-1', subscriptionId: 'sub_1', planId: 'premium', planName: 'Premium', status, gatewayStatus: 'x', amount: 2840.26, currencyCode: 'INR',
  billingFrequency: 'Monthly', currentPeriodStartUtc: '2026-11-01T00:00:00Z', currentPeriodEndUtc: '2026-12-01T00:00:00Z',
  nextRenewalUtc: status === 'Active' ? '2026-12-01T00:00:00Z' : null, autoRenew: status === 'Active', cancelAtCycleEnd: false, cancelledAtUtc: null,
  paymentMethod: 'upi', authorizationUrl: status === 'PendingAuthorization' ? 'https://rzp.io/i/abc' : null, mode: 'live', createdAt: '2026-11-01T00:00:00Z',
  ...overrides,
});

const trial: Subscription = { planId: 'trial', planName: 'Trial', status: 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null };
const onPremium: Subscription = { planId: 'premium', planName: 'Premium', status: 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null };

interface Setup {
  available?: boolean;
  /** What GET autopay/subscription returns, call after call (the last one repeats). */
  mandates?: (AutoPaySubscription | null)[];
  /** What refresh returns, call after call (the last one repeats). */
  refreshes?: (AutoPaySubscription | Observable<AutoPaySubscription>)[];
  subscriptions?: (Subscription | null)[];
  payments?: Payment[];
  refundsEnabled?: boolean;
}

/** A test in fake time that leaves nothing behind: the status polling and the snack bar's own timer are cleared at the end. */
const run = (body: () => void) =>
  fakeAsync(() => {
    body();
    discardPeriodicTasks();
    flush();
  });

describe('BillingListComponent with UPI AutoPay', () => {
  let fixture: ComponentFixture<BillingListComponent>;
  let billing: jasmine.SpyObj<BillingService>;
  let entitlementsLoad: jasmine.Spy;
  let open: jasmine.Spy;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => (el().querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const planButtons = () => Array.from(el().querySelectorAll<HTMLButtonElement>('.plan-card button'));
  const planLabels = () => planButtons().map((b) => b.textContent!.replace(/\s+/g, ' ').trim());
  const cardButton = (label: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.mandate-card button')).find((b) => b.textContent!.includes(label));

  function settle(ms = 0): void {
    fixture.detectChanges();
    tick(ms);
    fixture.detectChanges();
  }

  /** Presses the confirm button of the open dialog. */
  function confirmDialog(): void {
    settle();
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button'));
    buttons[buttons.length - 1].click();
    settle(500);
  }

  function sequence<T>(values: T[]): () => T {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
  }

  function render(setup: Setup = {}): void {
    billing = jasmine.createSpyObj<BillingService>('BillingService', [
      'getPlans', 'getSubscription', 'getQuota', 'getPaymentHistory', 'getCapabilities', 'getRefundRequests', 'choosePlan',
      'getAutoPayAvailability', 'getAutoPaySubscription', 'startAutoPayCheckout', 'refreshAutoPaySubscription', 'cancelAutoPaySubscription', 'getAutoPayInvoices',
    ]);
    billing.getPlans.and.returnValue(of([plan('trial', 0), plan('premium', 2407, 2840.26)]));
    const nextSubscription = sequence(setup.subscriptions ?? [trial]);
    billing.getSubscription.and.callFake(() => of(nextSubscription()));
    billing.getQuota.and.returnValue(of([]));
    billing.getPaymentHistory.and.returnValue(of(setup.payments ?? []));
    billing.getCapabilities.and.returnValue(of({ refundRequestsEnabled: setup.refundsEnabled ?? false }));
    billing.getRefundRequests.and.returnValue(of([]));
    billing.choosePlan.and.returnValue(of(onPremium));
    billing.getAutoPayAvailability.and.returnValue(of({ available: setup.available ?? true, reason: null, mode: 'live' }));
    const nextMandate = sequence(setup.mandates ?? [null]);
    billing.getAutoPaySubscription.and.callFake(() => of(nextMandate()));
    const nextRefresh = sequence(setup.refreshes ?? [mandate('PendingAuthorization')]);
    billing.refreshAutoPaySubscription.and.callFake(() => {
      const value = nextRefresh();
      return value instanceof Observable ? value : of(value);
    });
    billing.startAutoPayCheckout.and.returnValue(of({
      id: 'm-1', subscriptionId: 'sub_1', status: 'PendingAuthorization' as AutoPayStatus, authorizationUrl: 'https://rzp.io/i/abc', keyId: 'rzp_live_x',
      mode: 'live', amountMinor: 284026, currency: 'INR', planName: 'Premium',
    }));
    billing.cancelAutoPaySubscription.and.returnValue(of(mandate('CancellationScheduled', { cancelAtCycleEnd: true })));
    billing.getAutoPayInvoices.and.returnValue(of([]));

    entitlementsLoad = jasmine.createSpy('load').and.returnValue(of(null));
    open = spyOn(window, 'open').and.returnValue(null);

    TestBed.configureTestingModule({
      declarations: [BillingListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: EntitlementsService, useValue: { load: entitlementsLoad } },
      ],
    });
    fixture = TestBed.createComponent(BillingListComponent);
    settle();
  }

  afterEach(() => fixture?.destroy());

  // ----- Choosing how a plan is bought -----

  it('offers Subscribe on a paid plan and says it is paid by UPI AutoPay', run(() => {
    render();

    expect(planLabels()).toEqual(['Current plan', 'Subscribe now']);
    expect(text('.plan-card:nth-child(2) .plan-autopay')).toContain('UPI AutoPay');
    expect(el().querySelector('.plan-card:nth-child(1) .plan-autopay')).toBeNull();
  }));

  it('keeps the old buttons when the server says AutoPay is not available', run(() => {
    render({ available: false });

    expect(planLabels()).toEqual(['Current plan', 'Upgrade']);
    expect(el().querySelector('.plan-autopay')).toBeNull();

    planButtons()[1].click();
    confirmDialog();

    expect(billing.choosePlan).toHaveBeenCalledWith('premium');
    expect(billing.startAutoPayCheckout).not.toHaveBeenCalled();
  }));

  // ----- Subscribing -----

  it('starts a mandate for the plan alone, opens Razorpay, and shows it as pending - not active', run(() => {
    render({ mandates: [null, mandate('PendingAuthorization')] });

    planButtons()[1].click();
    confirmDialog();

    // Only the plan is sent: the amount is never the browser's to give.
    expect(billing.startAutoPayCheckout).toHaveBeenCalledOnceWith('premium');
    expect(billing.choosePlan).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledWith('https://rzp.io/i/abc', '_blank', 'noopener');

    expect(text('.mandate-status')).toBe('Pending authorization');
    expect(text('.mandate-notice')).toContain('not active until Razorpay confirms');
    // The plan has not changed: the tenant is still on what they were on.
    expect(planLabels()[0]).toBe('Current plan');
    expect(el().querySelectorAll('.plan-card.current').length).toBe(1);
    expect(entitlementsLoad).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  it('does nothing when the tenant backs out of the confirmation', run(() => {
    render();

    planButtons()[1].click();
    settle();
    document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button')[0].click();
    settle(500);

    expect(billing.startAutoPayCheckout).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  }));

  // ----- Coming back from Razorpay -----

  it('never shows Active just because the tenant came back: it asks the server, and shows what the server says', run(() => {
    render({ mandates: [mandate('PendingAuthorization')], refreshes: [mandate('PendingAuthorization')] });
    settle(BillingListComponent.pollEveryMs * 3);

    expect(billing.refreshAutoPaySubscription).toHaveBeenCalledWith('m-1');
    expect(billing.refreshAutoPaySubscription.calls.count()).toBeGreaterThan(1);
    expect(text('.mandate-status')).toBe('Pending authorization');
    expect(el().querySelector('.status-chip--opted-in.mandate-status')).toBeNull();
    expect(entitlementsLoad).not.toHaveBeenCalled();
    discardPeriodicTasks();
  }));

  it('shows Active, and reads the plan again, only once the server reports the mandate confirmed', run(() => {
    render({
      mandates: [mandate('PendingAuthorization')],
      refreshes: [mandate('PendingAuthorization'), mandate('PaymentPending'), mandate('Active')],
      subscriptions: [trial, onPremium],
    });
    expect(text('.mandate-status')).toBe('Pending authorization');

    settle(BillingListComponent.pollEveryMs);
    expect(text('.mandate-status')).toBe('Payment pending');
    expect(entitlementsLoad).not.toHaveBeenCalled();

    settle(BillingListComponent.pollEveryMs);
    expect(text('.mandate-status')).toBe('Active');
    expect(el().querySelector('.status-chip--opted-in.mandate-status')).not.toBeNull();
    expect(entitlementsLoad).toHaveBeenCalledWith(true);
    expect(planLabels()[1]).toBe('Current plan');
    expect(text('.plan-card.current h3')).toBe('premium');

    // Confirmed: nothing more is asked.
    const calls = billing.refreshAutoPaySubscription.calls.count();
    settle(BillingListComponent.pollEveryMs * 5);
    expect(billing.refreshAutoPaySubscription.calls.count()).toBe(calls);
  }));

  it('asks the server once to apply a paid mandate whose plan is not the current one yet, then reads the plan again', run(() => {
    render({ mandates: [mandate('Active')], refreshes: [mandate('Active')], subscriptions: [trial, onPremium] });

    expect(billing.refreshAutoPaySubscription).toHaveBeenCalledOnceWith('m-1');
    expect(text('.plan-card.current h3')).toBe('premium');
    expect(entitlementsLoad).toHaveBeenCalledWith(true);

    settle(BillingListComponent.pollEveryMs * 5);
    expect(billing.refreshAutoPaySubscription.calls.count()).toBe(1);
  }));

  it('does not ask the server again when the paid mandate is already the current plan', run(() => {
    render({ mandates: [mandate('Active')], subscriptions: [onPremium] });

    expect(billing.refreshAutoPaySubscription).not.toHaveBeenCalled();
  }));

  it('stops asking after a few minutes and leaves Check status to the tenant', run(() => {
    render({ mandates: [mandate('PendingAuthorization')] });

    settle(BillingListComponent.pollEveryMs * (BillingListComponent.pollTimes + 20));

    expect(billing.refreshAutoPaySubscription.calls.count()).toBe(BillingListComponent.pollTimes);

    cardButton('Check status')!.click();
    settle();
    expect(billing.refreshAutoPaySubscription.calls.count()).toBe(BillingListComponent.pollTimes + 1);
  }));

  it('stops asking when Razorpay cannot be reached, without breaking the page', run(() => {
    render({ mandates: [mandate('PendingAuthorization')], refreshes: [throwError(() => new Error('down'))] });

    settle(BillingListComponent.pollEveryMs * 4);

    expect(billing.refreshAutoPaySubscription.calls.count()).toBe(1);
    expect(text('.mandate-status')).toBe('Pending authorization');
  }));

  it('stops asking when the tenant leaves the page', run(() => {
    render({ mandates: [mandate('PendingAuthorization')] });
    settle(BillingListComponent.pollEveryMs);
    const calls = billing.refreshAutoPaySubscription.calls.count();

    fixture.destroy();
    tick(BillingListComponent.pollEveryMs * 5);

    expect(billing.refreshAutoPaySubscription.calls.count()).toBe(calls);
  }));

  it('lets the tenant reopen the Razorpay page while the mandate waits', run(() => {
    render({ mandates: [mandate('PendingAuthorization')] });

    cardButton('Authorize on Razorpay')!.click();

    expect(open).toHaveBeenCalledWith('https://rzp.io/i/abc', '_blank', 'noopener');
    expect(planLabels()[1]).toBe('Continue to authorize');
    discardPeriodicTasks();
  }));

  // ----- Every status -----

  const shown: [AutoPayStatus, string][] = [
    ['Active', 'Active'],
    ['PendingAuthorization', 'Pending authorization'],
    ['PaymentPending', 'Payment pending'],
    ['PastDue', 'Past due'],
    ['Halted', 'Halted'],
    ['Paused', 'Paused'],
    ['CancellationScheduled', 'Cancellation scheduled'],
    ['Cancelled', 'Cancelled'],
    ['Expired', 'Expired'],
  ];
  shown.forEach(([status, label]) => {
    it(`shows a ${status} mandate as "${label}"`, run(() => {
      render({ mandates: [mandate(status)], refreshes: [mandate(status)], subscriptions: [onPremium] });

      expect(text('.mandate-status')).toBe(label);
      // Green is for what is confirmed and running, and nothing else.
      expect(!!el().querySelector('.status-chip--opted-in.mandate-status')).toBe(status === 'Active');
      discardPeriodicTasks();
    }));
  });

  it('shows the plan, the monthly amount, the next payment and auto-renewal for a running mandate', run(() => {
    render({ mandates: [mandate('Active')], subscriptions: [onPremium] });

    const facts = text('.mandate-facts');
    expect(text('.mandate-card h3')).toBe('Premium');
    expect(facts).toContain('₹2,840.26/month');
    expect(facts).toContain('Next payment');
    expect(facts).toMatch(/Auto-renewal\s*On/);
    expect(facts).toContain('UPI');
    expect(el().querySelector('.mandate-notice')).toBeNull();
  }));

  it('says so plainly when the mandate was made with test keys', run(() => {
    render({ mandates: [mandate('Active', { mode: 'test' })], subscriptions: [onPremium] });

    expect(text('.mandate-facts')).toContain('no real money moves');
  }));

  // ----- A failed payment -----

  it('tells the tenant a payment failed and is being retried', run(() => {
    render({ mandates: [mandate('PastDue')], subscriptions: [onPremium] });

    expect(el().querySelector('.mandate-card--problem')).not.toBeNull();
    expect(text('.mandate-notice--problem')).toContain("didn't go through");
    expect(text('.mandate-notice--problem')).toContain('tried again automatically');
  }));

  it('tells the tenant what to do when automatic payment has stopped', run(() => {
    render({ mandates: [mandate('Halted')], subscriptions: [onPremium] });

    expect(text('.mandate-notice--problem')).toContain('cancel this mandate and subscribe again');
    expect(cardButton('Cancel automatic payment')).toBeTruthy();
  }));

  it('shows a failed payment in the history with its reason, and never as money paid', run(() => {
    const failed: Payment = {
      id: 'p2', planName: 'Premium', amountCents: 2900, currencyCode: 'INR', currencySymbol: '₹', localAmount: 2407, totalLocal: 2840.26,
      provider: 'Razorpay', paidAtUtc: '2026-12-01T00:00:00Z', kind: 'Subscription', status: 'Failed', failureReason: 'Insufficient balance',
      paymentMethod: 'upi', transactionId: 'pay_2',
    };
    const paid: Payment = { ...failed, id: 'p1', status: 'Succeeded', failureReason: null, transactionId: 'pay_1', paidAtUtc: '2026-11-01T00:00:00Z' };
    render({ mandates: [mandate('PastDue')], subscriptions: [onPremium], payments: [failed, paid], refundsEnabled: true });

    const rows = Array.from(el().querySelectorAll('.payment-history-card .payment-row'));
    expect(rows[0].textContent).toContain('Failed: Insufficient balance');
    expect(rows[0].querySelector('.payment-amount.failed')).not.toBeNull();
    expect(rows[0].textContent).toContain('UPI · pay_2');
    expect(rows[1].querySelector('.payment-failure')).toBeNull();
    expect(rows[1].textContent).toContain('UPI · pay_1');
    // The server refunds neither a failed attempt nor a Razorpay payment from here, so no button offers it.
    expect(el().querySelector('.payment-history-card .payment-action button')).toBeNull();
  }));

  // ----- Cancelling -----

  it('cancels a running mandate at the end of the paid period, after confirming', run(() => {
    render({ mandates: [mandate('Active')], subscriptions: [onPremium] });

    cardButton('Cancel automatic payment')!.click();
    settle();
    expect(document.querySelector('mat-dialog-container')!.textContent).toContain('stays active until');
    confirmDialog();

    expect(billing.cancelAutoPaySubscription).toHaveBeenCalledOnceWith('m-1', true);
    expect(text('.mandate-status')).toBe('Cancellation scheduled');
    expect(text('.mandate-notice')).toContain('stays active until the end of the period');
    expect(cardButton('Cancel automatic payment')).toBeUndefined();
  }));

  it('does not cancel when the tenant chooses to keep it', run(() => {
    render({ mandates: [mandate('Active')], subscriptions: [onPremium] });

    cardButton('Cancel automatic payment')!.click();
    settle();
    document.querySelectorAll<HTMLButtonElement>('mat-dialog-container button')[0].click();
    settle(500);

    expect(billing.cancelAutoPaySubscription).not.toHaveBeenCalled();
    expect(text('.mandate-status')).toBe('Active');
  }));

  it('withdraws a request nobody approved straight away, and stops watching it', run(() => {
    render({ mandates: [mandate('PendingAuthorization')] });
    billing.cancelAutoPaySubscription.and.returnValue(of(mandate('Cancelled')));

    cardButton('Cancel request')!.click();
    confirmDialog();

    expect(billing.cancelAutoPaySubscription).toHaveBeenCalledOnceWith('m-1', false);
    expect(text('.mandate-status')).toBe('Cancelled');
    const calls = billing.refreshAutoPaySubscription.calls.count();
    settle(BillingListComponent.pollEveryMs * 3);
    expect(billing.refreshAutoPaySubscription.calls.count()).toBe(calls);
    // And the tenant can subscribe again.
    expect(planButtons()[1].disabled).toBeFalse();
  }));

  it('cancels a halted mandate now: there is no paid period to wait for', run(() => {
    render({ mandates: [mandate('Halted')], subscriptions: [onPremium] });
    billing.cancelAutoPaySubscription.and.returnValue(of(mandate('Cancelled')));

    cardButton('Cancel automatic payment')!.click();
    confirmDialog();

    expect(billing.cancelAutoPaySubscription).toHaveBeenCalledOnceWith('m-1', false);
  }));

  it('does not let the plan be changed under a mandate that is still charging', run(() => {
    render({ mandates: [mandate('Active')], subscriptions: [onPremium] });

    expect(planButtons().every((b) => b.disabled)).toBeTrue();
  }));

  it('lets the tenant subscribe again once the mandate has ended', run(() => {
    render({ mandates: [mandate('Cancelled')] });

    expect(planLabels()[1]).toBe('Subscribe now');
    expect(planButtons()[1].disabled).toBeFalse();
  }));

  // ----- Invoices -----

  it('reads the invoices from the server when asked, with a link to each', run(() => {
    render({ mandates: [mandate('Active')], subscriptions: [onPremium] });
    billing.getAutoPayInvoices.and.returnValue(of([
      {
        invoiceId: 'inv_1', invoiceNumber: null, status: 'paid', amount: 2840.26, amountPaid: 2840.26, currencyCode: 'INR', issuedAtUtc: '2026-11-01T00:00:00Z',
        paidAtUtc: '2026-11-01T00:05:00Z', periodStartUtc: '2026-11-01T00:00:00Z', periodEndUtc: '2026-12-01T00:00:00Z', transactionId: 'pay_1', url: 'https://rzp.io/i/inv1',
      },
    ]));
    expect(billing.getAutoPayInvoices).not.toHaveBeenCalled();

    cardButton('Invoices')!.click();
    settle();

    expect(billing.getAutoPayInvoices).toHaveBeenCalledOnceWith('m-1');
    const row = el().querySelector('.invoice-list .payment-row')!;
    expect(row.textContent).toContain('inv_1');
    expect(row.textContent).toContain('₹2,840.26');
    expect(row.textContent).toContain('Paid');
    const link = row.querySelector<HTMLAnchorElement>('a')!;
    expect(link.getAttribute('href')).toBe('https://rzp.io/i/inv1');
    expect(link.getAttribute('rel')).toBe('noopener');

    cardButton('Hide invoices')!.click();
    settle();
    expect(el().querySelector('.invoice-list')).toBeNull();
  }));

  it('shows no mandate card to a tenant who never started one', run(() => {
    render();

    expect(el().querySelector('.mandate-card')).toBeNull();
  }));
});
