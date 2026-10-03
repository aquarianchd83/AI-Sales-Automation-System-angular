import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

import { RazorpayCheckout, RazorpayFailureResponse, RazorpaySuccessResponse } from '../models/razorpay.model';

export const RAZORPAY_CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

/** What happens in the Checkout window. "failed" is not the end - the customer can try again in the same window. */
export type CheckoutEvent =
  | { kind: 'success'; response: RazorpaySuccessResponse }
  | { kind: 'failed'; response: RazorpayFailureResponse }
  | { kind: 'dismissed' };

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void): void;
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

/**
 * Loads Razorpay Checkout (once) and opens it for an order. The script comes from checkout.razorpay.com, which the production
 * Content-Security-Policy allows; it is loaded only when a payment is started, never on app start.
 */
@Injectable({ providedIn: 'root' })
export class RazorpayCheckoutService {
  private loading: Promise<RazorpayConstructor> | null = null;

  constructor(@Inject(DOCUMENT) private readonly document: Document, private readonly zone: NgZone) {}

  load(): Promise<RazorpayConstructor> {
    const existing = this.constructorOrNull();
    if (existing) {
      return Promise.resolve(existing);
    }
    if (!this.loading) {
      this.loading = new Promise<RazorpayConstructor>((resolve, reject) => {
        const script = this.document.createElement('script');
        script.src = RAZORPAY_CHECKOUT_SCRIPT;
        script.async = true;
        script.onload = () => {
          const ctor = this.constructorOrNull();
          ctor ? resolve(ctor) : reject(new Error('Razorpay Checkout loaded but did not start.'));
        };
        script.onerror = () => {
          this.loading = null;
          script.remove();
          reject(new Error('Razorpay Checkout could not be loaded. Check the network, an ad blocker, or the Content-Security-Policy.'));
        };
        this.document.body.appendChild(script);
      });
    }
    return this.loading;
  }

  /** Opens Checkout for the order. Emits each failed attempt, then completes on success or when the window is closed. */
  open(checkout: RazorpayCheckout): Observable<CheckoutEvent> {
    return new Observable<CheckoutEvent>((subscriber) => {
      let finished = false;
      const finish = (event: CheckoutEvent) =>
        this.zone.run(() => {
          if (finished) {
            return;
          }
          finished = true;
          subscriber.next(event);
          subscriber.complete();
        });

      this.load()
        .then((Razorpay) => {
          const instance = new Razorpay({
            key: checkout.keyId,
            order_id: checkout.orderId,
            amount: checkout.amount,
            currency: checkout.currency,
            name: checkout.name,
            description: checkout.description,
            prefill: {
              name: checkout.prefill.name ?? undefined,
              email: checkout.prefill.email ?? undefined,
              contact: checkout.prefill.contact ?? undefined,
            },
            notes: { source: 'platform-razorpay-test' },
            theme: { color: '#00796b' },
            handler: (response: RazorpaySuccessResponse) => finish({ kind: 'success', response }),
            modal: { ondismiss: () => finish({ kind: 'dismissed' }) },
          });
          instance.on('payment.failed', (response) => this.zone.run(() => subscriber.next({ kind: 'failed', response })));
          instance.open();
        })
        .catch((error: unknown) => this.zone.run(() => subscriber.error(error)));
    });
  }

  private constructorOrNull(): RazorpayConstructor | null {
    const ctor = (this.document.defaultView as unknown as { Razorpay?: RazorpayConstructor } | null)?.Razorpay;
    return typeof ctor === 'function' ? ctor : null;
  }
}
