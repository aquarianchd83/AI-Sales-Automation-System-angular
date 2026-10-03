import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject, of, throwError } from 'rxjs';

import { RazorpayCheckout, RazorpayOrder, RazorpaySettings } from '../../core/models/razorpay.model';
import { NotificationService } from '../../core/services/notification.service';
import { CheckoutEvent, RazorpayCheckoutService } from '../../core/services/razorpay-checkout.service';
import { RazorpayTestService } from '../../core/services/razorpay-test.service';
import { SharedModule } from '../../shared/shared.module';
import { RazorpayTestPageComponent } from './razorpay-test-page.component';

const settings = (over: Partial<RazorpaySettings> = {}): RazorpaySettings => ({
  keyId: 'rzp_test_1DP5mmOlF5G5ag',
  mode: 'test',
  hasKeySecret: true,
  keySecretHint: '••••1234',
  hasWebhookSecret: true,
  webhookSecretHint: '••••9876',
  isConfigured: true,
  webhookPath: '/api/v1/webhooks/razorpay',
  ...over,
});

const order = (over: Partial<RazorpayOrder> = {}): RazorpayOrder => ({
  id: 'o1',
  orderId: 'order_ABC',
  receipt: 'rzp-test-1',
  amountMinor: 10000,
  currency: 'INR',
  description: 'Platform test payment',
  status: 'Paid',
  mode: 'test',
  paymentId: 'pay_1',
  method: 'upi',
  signatureVerifiedAtUtc: '2026-10-03T10:00:00Z',
  paidAtUtc: '2026-10-03T10:00:00Z',
  refundedMinor: 0,
  lastRefundId: null,
  failureReason: null,
  lastWebhookEvent: 'payment.captured',
  lastWebhookAtUtc: '2026-10-03T10:00:05Z',
  createdAt: '2026-10-03T09:59:00Z',
  ...over,
});

const checkoutDto: RazorpayCheckout = {
  id: 'o1', orderId: 'order_ABC', keyId: 'rzp_test_1DP5mmOlF5G5ag', mode: 'test', amount: 100, currency: 'INR',
  name: 'Sales Automation', description: 'Platform test payment', prefill: { name: null, email: null, contact: null },
};

describe('RazorpayTestPageComponent', () => {
  let api: jasmine.SpyObj<RazorpayTestService>;
  let checkout: jasmine.SpyObj<RazorpayCheckoutService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let events$: Subject<CheckoutEvent>;

  const create = (s: RazorpaySettings = settings(), orders: RazorpayOrder[] = []) => {
    api = jasmine.createSpyObj('RazorpayTestService', [
      'getSettings', 'saveSettings', 'testKeys', 'createOrder', 'verify', 'reportFailure', 'refund', 'getOrders', 'getWebhookEvents',
    ]);
    api.getSettings.and.returnValue(of(s));
    api.getOrders.and.returnValue(of(orders));
    api.getWebhookEvents.and.returnValue(of([]));
    api.saveSettings.and.callFake(() => of(s));
    events$ = new Subject<CheckoutEvent>();
    checkout = jasmine.createSpyObj('RazorpayCheckoutService', ['open', 'load']);
    checkout.open.and.returnValue(events$);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [RazorpayTestPageComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: RazorpayTestService, useValue: api },
        { provide: RazorpayCheckoutService, useValue: checkout },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(RazorpayTestPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  };

  it('loads the keys with secrets only as hints, and shows the webhook URL for this origin', () => {
    const { component, text } = create();

    expect(component.keysForm.controls.keyId.value).toBe('rzp_test_1DP5mmOlF5G5ag');
    expect(component.keysForm.controls.keySecret.value).toBe('');
    expect(component.hint('key')).toBe('••••1234');
    expect(component.webhookUrl).toBe(`${window.location.origin}/api/v1/webhooks/razorpay`);
    expect(text()).toContain('test mode');
  });

  it('warns loudly when live keys are saved', () => {
    expect(create(settings({ keyId: 'rzp_live_ILgsfZCZoFIKMb', mode: 'live' })).text()).toContain('Payments made here charge real money');
  });

  it('keeps secrets left blank, clears them on request, and refuses a key id that is not Razorpay\'s', () => {
    const { component } = create();
    component.keysForm.patchValue({ keySecret: ' new-secret ' });
    component.keysForm.markAsDirty();
    component.saveKeys();
    expect(api.saveSettings.calls.mostRecent().args[0]).toEqual({ keyId: 'rzp_test_1DP5mmOlF5G5ag', keySecret: 'new-secret', webhookSecret: null });

    component.keysForm.patchValue({ removeWebhookSecret: true });
    component.keysForm.markAsDirty();
    component.saveKeys();
    expect(api.saveSettings.calls.mostRecent().args[0].webhookSecret).toBe('');

    api.saveSettings.calls.reset();
    component.keysForm.patchValue({ keyId: 'sk_live_123' });
    component.keysForm.markAsDirty();
    component.saveKeys();
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it('tests the keys on screen and shows the answer', () => {
    const { fixture, component, text } = create();
    api.testKeys.and.returnValue(of({ success: false, message: 'Authentication failed' }));

    component.testKeys();
    fixture.detectChanges();

    expect(api.testKeys).toHaveBeenCalledWith('rzp_test_1DP5mmOlF5G5ag', null);
    expect(text()).toContain('Authentication failed');
  });

  it('will not start a payment without keys or with a bad amount', () => {
    const { component } = create(settings({ isConfigured: false, hasKeySecret: false }));
    component.pay();
    expect(api.createOrder).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();

    TestBed.resetTestingModule();
    const ready = create();
    ready.component.payForm.patchValue({ amount: 0.5 });
    ready.component.pay();
    expect(api.createOrder).not.toHaveBeenCalled();
  });

  it('creates an order, opens Checkout, and lets the server verify the payment', () => {
    const { fixture, component, text } = create();
    api.createOrder.and.returnValue(of(checkoutDto));
    api.verify.and.returnValue(of({
      success: true,
      message: 'Payment of INR 1.00 verified and captured.',
      steps: [{ label: 'Signature checked on the server', ok: true, detail: 'matches' }, { label: 'Amount and order match', ok: true, detail: 'INR 1.00' }],
      order: order(),
    }));
    component.payForm.patchValue({ amount: 1, customerEmail: 'asha@example.com' });

    component.pay();
    expect(api.createOrder.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ amount: 1, currency: 'INR', customerEmail: 'asha@example.com' }));
    expect(checkout.open).toHaveBeenCalledWith(checkoutDto);
    expect(component.paying).toBeTrue();

    events$.next({ kind: 'success', response: { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_ABC', razorpay_signature: 'sig' } });
    fixture.detectChanges();

    expect(api.verify).toHaveBeenCalledWith('o1', { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_ABC', razorpay_signature: 'sig' });
    expect(component.paying).toBeFalse();
    expect(text()).toContain('Signature checked on the server');
    expect(text()).toContain('Payment of INR 1.00 verified and captured.');
  });

  it('reports a failed attempt but keeps waiting, and handles the window being closed', () => {
    const { component } = create();
    api.createOrder.and.returnValue(of(checkoutDto));
    api.reportFailure.and.returnValue(of(order({ status: 'Failed' })));

    component.pay();
    events$.next({ kind: 'failed', response: { error: { code: 'BAD_REQUEST_ERROR', description: 'Payment failed', reason: 'payment_failed', metadata: { payment_id: 'pay_0' } } } });

    expect(api.reportFailure).toHaveBeenCalledWith('o1', { paymentId: 'pay_0', code: 'BAD_REQUEST_ERROR', description: 'Payment failed', reason: 'payment_failed' });
    expect(component.paying).toBeTrue();
    expect(component.flow.some((s) => s.state === 'fail')).toBeTrue();

    events$.next({ kind: 'dismissed' });
    expect(component.paying).toBeFalse();
    expect(api.verify).not.toHaveBeenCalled();
  });

  it('says so when Checkout cannot load', () => {
    const { component } = create();
    api.createOrder.and.returnValue(of(checkoutDto));
    checkout.open.and.returnValue(throwError(() => new Error('Razorpay Checkout could not be loaded.')));

    component.pay();

    expect(component.paying).toBeFalse();
    expect(component.flow[component.flow.length - 1]).toEqual(jasmine.objectContaining({ state: 'fail', detail: 'Razorpay Checkout could not be loaded.' }));
  });

  it('refunds part or all of a paid order, never more than is left', () => {
    const { component } = create(settings(), [order(), order({ id: 'o2', orderId: 'order_X', status: 'Created', paymentId: null })]);
    expect(component.canRefund(component.orders[0])).toBeTrue();
    expect(component.canRefund(component.orders[1])).toBeFalse();
    const refunded = order({ status: 'PartiallyRefunded', refundedMinor: 4000 });
    api.refund.and.returnValue(of(refunded));
    // The page reloads the list after a refund; the server now reports the refunded order.
    api.getOrders.and.returnValue(of([refunded]));

    component.startRefund(component.orders[0]);
    component.refundAmount.setValue(100.01);
    component.confirmRefund();
    expect(api.refund).not.toHaveBeenCalled();

    component.refundAmount.setValue(40);
    component.confirmRefund();
    expect(api.refund).toHaveBeenCalledWith('o1', 40);
    expect(component.orders[0].status).toBe('PartiallyRefunded');
    expect(component.refunding).toBeNull();

    component.startRefund(component.orders[0]);
    component.confirmRefund();
    expect(api.refund.calls.mostRecent().args[1]).toBeNull();
  });

  it('lists orders and webhook events', () => {
    const { text } = create(settings(), [order()]);
    expect(text()).toContain('order_ABC');
    expect(text()).toContain('INR 100.00');
    expect(text()).toContain('No webhooks yet');
  });
});
