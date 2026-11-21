import { TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { RechargeCheckout, RechargeTransaction, RechargeVerifyResult } from '../models/wallet-recharge.model';
import { CheckoutEvent, RazorpayCheckoutService } from './razorpay-checkout.service';
import { RazorpayPaymentFlowService, RazorpayPaymentOutcome } from './razorpay-payment-flow.service';
import { WalletRechargeService } from './wallet-recharge.service';

const ORDER: RechargeCheckout = {
  transactionId: 'txn-1', reference: 'wr-1', orderId: 'order_1', keyId: 'rzp_test_1', mode: 'test', amountMinor: 59_000, currency: 'INR',
  businessName: 'AiSaarthi', description: '500 credits', amount: 500, tax: 90, total: 590, credits: 500, prefill: { name: null, email: null, contact: null },
};

const TXN = (status: RechargeTransaction['status']): RechargeTransaction =>
  ({ id: 'txn-1', status, credits: 500, amount: 500, failureReason: status === 'Failed' ? 'Bank declined' : null } as RechargeTransaction);

const SUCCESS: CheckoutEvent = { kind: 'success', response: { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' } };

/** The server, never Checkout's callback, decides whether a payment counts. */
describe('RazorpayPaymentFlowService', () => {
  function setup(events: CheckoutEvent[], verify: () => Observable<RechargeVerifyResult>, status: () => Observable<RechargeTransaction>) {
    const checkout = { open: jasmine.createSpy('open').and.returnValue(of(...events)) };
    const recharge = { verifyPayment: jasmine.createSpy('verifyPayment').and.callFake(verify), getStatus: jasmine.createSpy('getStatus').and.callFake(status) };
    TestBed.configureTestingModule({
      providers: [
        { provide: RazorpayCheckoutService, useValue: checkout },
        { provide: WalletRechargeService, useValue: recharge },
      ],
    });
    const outcomes: RazorpayPaymentOutcome[] = [];
    TestBed.inject(RazorpayPaymentFlowService).pay(ORDER).subscribe((o) => outcomes.push(o));
    return { checkout, recharge, outcomes };
  }

  const verified = (r: Partial<RechargeVerifyResult>) => () => of({ success: false, pending: false, message: '', transaction: null, balance: null, ...r } as RechargeVerifyResult);

  it('opens Checkout for the server-made order and reports credited only when the server verified it', fakeAsync(() => {
    const { checkout, recharge, outcomes } = setup([SUCCESS], verified({ success: true, transaction: TXN('Credited'), balance: 900 }), () => of(TXN('Credited')));
    flush();

    expect(checkout.open.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ orderId: 'order_1', keyId: 'rzp_test_1', amount: 59_000 }));
    expect(recharge.verifyPayment).toHaveBeenCalledWith({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' });
    expect(outcomes).toEqual([{ kind: 'credited', transaction: TXN('Credited'), balance: 900 }]);
  }));

  it('polls the server while a genuine payment is pending, until it is credited', fakeAsync(() => {
    let calls = 0;
    const { outcomes } = setup([SUCCESS], verified({ pending: true }), () => of(TXN(++calls < 3 ? 'Authorized' : 'Credited')));
    tick(3000 * 3);
    flush();

    expect(calls).toBe(3);
    expect(outcomes).toEqual([{ kind: 'credited', transaction: TXN('Credited'), balance: null }]);
  }));

  it('asks the server instead of failing when the verify call itself errors', fakeAsync(() => {
    const { recharge, outcomes } = setup([SUCCESS], () => throwError(() => new Error('network')), () => of(TXN('Credited')));
    tick(0);

    expect(recharge.getStatus).toHaveBeenCalledWith('txn-1');
    expect(outcomes[0].kind).toBe('credited');
  }));

  it('reports a refused payment in the server\'s words', fakeAsync(() => {
    const { outcomes } = setup([SUCCESS], verified({ message: 'The signature does not match.' }), () => of(TXN('Failed')));
    flush();

    expect(outcomes).toEqual([{ kind: 'failed', message: 'The signature does not match.' }]);
  }));

  it('passes on a failed attempt, and checks with the server once when the window is closed', fakeAsync(() => {
    const { outcomes, recharge } = setup(
      [{ kind: 'failed', response: { error: { code: 'BAD', description: 'Card declined' } } } as CheckoutEvent, { kind: 'dismissed' }],
      verified({}),
      () => of(TXN('Created'))
    );
    tick(2000);
    flush();

    expect(recharge.verifyPayment).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ kind: 'attempt-failed', message: 'Card declined' }, { kind: 'closed' }]);
  }));

  it('counts a payment completed after the window was closed', fakeAsync(() => {
    const { outcomes } = setup([{ kind: 'dismissed' }], verified({}), () => of(TXN('Credited')));
    tick(2000);
    flush();

    expect(outcomes[0].kind).toBe('credited');
  }));
});
