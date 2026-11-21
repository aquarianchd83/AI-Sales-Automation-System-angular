import { Injectable } from '@angular/core';
import { Observable, of, timer } from 'rxjs';
import { catchError, filter, last, map, switchMap, take, takeWhile } from 'rxjs/operators';

import { RazorpayCheckout } from '../models/razorpay.model';
import { RechargeCheckout, RechargeTransaction, isRechargePending } from '../models/wallet-recharge.model';
import { RazorpayCheckoutService } from './razorpay-checkout.service';
import { WalletRechargeService } from './wallet-recharge.service';

/** Asked every few seconds, a little over a minute: long enough for a UPI app to finish, short enough to stop on its own. */
const POLL_EVERY_MS = 3000;
const POLL_TIMES = 20;

/**
 * What became of one Razorpay payment, as the SERVER reports it.
 * - credited: the money is captured and the credits are in the wallet.
 * - pending: genuine but not confirmed yet; the webhook or the reconciliation job will credit it.
 * - failed: the payment did not go through, or was not accepted.
 * - closed: the Checkout window was closed with nothing paid that the server knows of.
 * - attempt-failed: one try inside the open window failed; the customer can still try again, so the flow goes on.
 */
export type RazorpayPaymentOutcome =
  | { kind: 'credited'; transaction: RechargeTransaction | null; balance: number | null }
  | { kind: 'pending' }
  | { kind: 'failed'; message: string }
  | { kind: 'closed' }
  | { kind: 'attempt-failed'; message: string };

/**
 * Takes a Razorpay order the server made (a wallet top-up or a credit pack) through Checkout to a settled outcome: opens Checkout, hands Checkout's
 * identifiers to the server for verification, and if the answer is not final yet asks the server for the transaction's status until it is. The
 * browser's own "success" callback never counts as paid - only the server's answer does.
 */
@Injectable({ providedIn: 'root' })
export class RazorpayPaymentFlowService {
  constructor(
    private readonly checkout: RazorpayCheckoutService,
    private readonly recharge: WalletRechargeService
  ) {}

  /** Emits any failed attempts, then exactly one final outcome, then completes. Errors only if Checkout itself cannot be loaded. */
  pay(order: RechargeCheckout): Observable<RazorpayPaymentOutcome> {
    return this.checkout.open(this.toCheckout(order)).pipe(
      switchMap((event): Observable<RazorpayPaymentOutcome> => {
        if (event.kind === 'failed') {
          return of({ kind: 'attempt-failed', message: event.response.error.description ?? 'That payment did not go through. You can try again.' });
        }
        if (event.kind === 'success') {
          return this.recharge
            .verifyPayment({
              razorpay_order_id: event.response.razorpay_order_id,
              razorpay_payment_id: event.response.razorpay_payment_id,
              razorpay_signature: event.response.razorpay_signature,
            })
            .pipe(
              switchMap((result): Observable<RazorpayPaymentOutcome> => {
                if (result.success) {
                  return of({ kind: 'credited', transaction: result.transaction, balance: result.balance });
                }
                return result.pending ? this.poll(order.transactionId) : of({ kind: 'failed', message: result.message });
              }),
              // The payment may well have gone through even though we could not hear the answer: ask again rather than say it failed.
              catchError(() => this.poll(order.transactionId))
            );
        }
        // Closed without a success callback. A UPI payment can still complete afterwards, so ask the server once before giving up.
        return timer(2000).pipe(
          switchMap(() => this.recharge.getStatus(order.transactionId).pipe(catchError(() => of(null)))),
          switchMap((transaction): Observable<RazorpayPaymentOutcome> => {
            if (transaction?.status === 'Credited') {
              return of({ kind: 'credited', transaction, balance: null });
            }
            return transaction?.status === 'Authorized' ? this.poll(order.transactionId) : of({ kind: 'closed' });
          })
        );
      })
    );
  }

  /** Asks the server (which asks Razorpay) until the transaction is settled, or gives up after about a minute and says it is still pending. */
  private poll(transactionId: string): Observable<RazorpayPaymentOutcome> {
    return timer(0, POLL_EVERY_MS).pipe(
      take(POLL_TIMES),
      switchMap(() => this.recharge.getStatus(transactionId).pipe(catchError(() => of(null)))),
      filter((transaction): transaction is RechargeTransaction => transaction !== null),
      takeWhile((transaction) => isRechargePending(transaction.status), true),
      last(undefined, null as RechargeTransaction | null),
      map((transaction): RazorpayPaymentOutcome => {
        if (transaction?.status === 'Credited') {
          return { kind: 'credited', transaction, balance: null };
        }
        if (transaction && !isRechargePending(transaction.status)) {
          return { kind: 'failed', message: transaction.failureReason ?? 'The payment did not go through.' };
        }
        return { kind: 'pending' };
      })
    );
  }

  private toCheckout(order: RechargeCheckout): RazorpayCheckout {
    return {
      id: order.transactionId,
      orderId: order.orderId,
      keyId: order.keyId,
      mode: order.mode,
      amount: order.amountMinor,
      currency: order.currency,
      name: order.businessName,
      description: order.description,
      prefill: order.prefill,
    };
  }
}
