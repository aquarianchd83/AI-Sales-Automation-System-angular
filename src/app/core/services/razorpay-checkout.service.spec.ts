import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';

import { RazorpayCheckout } from '../models/razorpay.model';
import { CheckoutEvent, RAZORPAY_CHECKOUT_SCRIPT, RazorpayCheckoutService } from './razorpay-checkout.service';

const checkout: RazorpayCheckout = {
  id: 'o1', orderId: 'order_ABC', keyId: 'rzp_test_1DP5mmOlF5G5ag', mode: 'test', amount: 49950, currency: 'INR',
  name: 'Sales Automation', description: 'Test', prefill: { name: 'Asha', email: null, contact: '+919876543210' },
};

describe('RazorpayCheckoutService', () => {
  let service: RazorpayCheckoutService;
  let doc: Document;
  let options: Record<string, unknown> | null;
  let failedHandler: ((r: unknown) => void) | null;
  let opened: number;

  class FakeRazorpay {
    constructor(o: Record<string, unknown>) {
      options = o;
    }
    on(_: string, handler: (r: unknown) => void): void {
      failedHandler = handler;
    }
    open(): void {
      opened++;
    }
  }

  beforeEach(() => {
    options = null;
    failedHandler = null;
    opened = 0;
    TestBed.configureTestingModule({});
    service = TestBed.inject(RazorpayCheckoutService);
    doc = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    delete (window as unknown as { Razorpay?: unknown }).Razorpay;
    doc.querySelectorAll(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`).forEach((s) => s.remove());
  });

  it('adds the Checkout script once, from checkout.razorpay.com', () => {
    service.load().catch(() => undefined);
    service.load().catch(() => undefined);

    const scripts = doc.querySelectorAll(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`);
    expect(scripts.length).toBe(1);
    expect(RAZORPAY_CHECKOUT_SCRIPT).toBe('https://checkout.razorpay.com/v1/checkout.js');
  });

  it('opens Checkout for the order and passes the success response on', async () => {
    (window as unknown as { Razorpay: unknown }).Razorpay = FakeRazorpay;
    const events: CheckoutEvent[] = [];
    let completed = false;

    service.open(checkout).subscribe({ next: (e) => events.push(e), complete: () => (completed = true) });
    await Promise.resolve();
    await Promise.resolve();

    expect(opened).toBe(1);
    expect(options).toEqual(jasmine.objectContaining({ key: 'rzp_test_1DP5mmOlF5G5ag', order_id: 'order_ABC', amount: 49950, currency: 'INR' }));
    expect((options!['prefill'] as Record<string, unknown>)['contact']).toBe('+919876543210');

    failedHandler!({ error: { code: 'BAD_REQUEST_ERROR' } });
    expect(events[0].kind).toBe('failed');
    expect(completed).toBeFalse();

    (options!['handler'] as (r: unknown) => void)({ razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_ABC', razorpay_signature: 'sig' });
    expect(events[1]).toEqual({ kind: 'success', response: { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_ABC', razorpay_signature: 'sig' } });
    expect(completed).toBeTrue();
  });

  it('completes when the window is closed', async () => {
    (window as unknown as { Razorpay: unknown }).Razorpay = FakeRazorpay;
    const events: CheckoutEvent[] = [];

    service.open(checkout).subscribe((e) => events.push(e));
    await Promise.resolve();
    await Promise.resolve();
    ((options!['modal'] as Record<string, unknown>)['ondismiss'] as () => void)();

    expect(events).toEqual([{ kind: 'dismissed' }]);
  });
});
