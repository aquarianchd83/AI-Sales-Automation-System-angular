import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Subject, of, timer } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, take, takeUntil, takeWhile, tap } from 'rxjs/operators';

import { PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { RazorpayCheckout, RazorpaySuccessResponse } from '../../../core/models/razorpay.model';
import {
  RECHARGE_STATUS_LABELS,
  RechargeCheckout,
  RechargeOptions,
  RechargeQuote,
  RechargeStatus,
  RechargeTransaction,
  RechargeVerifyResult,
  formatCredits,
  formatRupees,
  isRechargePending,
} from '../../../core/models/wallet-recharge.model';
import { EntitlementsService } from '../../../core/services/entitlements.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RazorpayCheckoutService } from '../../../core/services/razorpay-checkout.service';
import { WalletRechargeService } from '../../../core/services/wallet-recharge.service';

/** At most two decimals: a paisa is the smallest thing Razorpay can charge. */
export function twoDecimals(control: AbstractControl): ValidationErrors | null {
  const value = control.value as number | null;
  return value == null || Math.round(value * 100) / 100 === value ? null : { decimals: true };
}

/** Asked every few seconds, a little over a minute: long enough for a UPI app to finish, short enough to stop on its own. */
const POLL_EVERY_MS = 3000;
const POLL_TIMES = 20;

/**
 * Buying wallet credits. The browser never decides what a recharge costs or whether it worked: the server prices the amount, creates the Razorpay
 * order, verifies the payment (signature and Razorpay's own record) and credits the wallet. This screen only opens Checkout, passes Razorpay's identifiers
 * back for verification, and shows the balance once the server says it is credited - never on Checkout's own "success" callback.
 */
@Component({
  selector: 'app-wallet-recharge',
  templateUrl: './wallet-recharge.component.html',
  styleUrls: ['./wallet-recharge.component.scss'],
})
export class WalletRechargeComponent implements OnInit, OnDestroy {
  readonly formatRupees = formatRupees;
  readonly statusLabel = (status: RechargeStatus): string => RECHARGE_STATUS_LABELS[status] ?? status;
  readonly isPending = isRechargePending;
  readonly historyColumns = ['when', 'reference', 'amount', 'total', 'credits', 'method', 'status', 'actions'];

  readonly amount = new FormControl<number | null>(null, { validators: [Validators.required, twoDecimals] });

  options: RechargeOptions | null = null;
  loading = true;
  loadError: string | null = null;

  selectedPreset: number | null = null;
  quote: RechargeQuote | null = null;
  quoting = false;
  quoteError: string | null = null;

  /** True from clicking Pay until the server has said what became of the payment. */
  processing = false;
  processingMessage = '';

  history: PagedResult<RechargeTransaction> = emptyPage(10);
  historyLoading = false;
  private page = 1;
  private pageSize = 10;

  private readonly destroy$ = new Subject<void>();
  private readonly stopPolling$ = new Subject<void>();

  constructor(
    private readonly recharge: WalletRechargeService,
    private readonly checkout: RazorpayCheckoutService,
    private readonly entitlements: EntitlementsService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.recharge
      .getOptions()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (options) => {
          this.options = options;
          this.amount.addValidators([Validators.min(options.minAmount), Validators.max(options.maxAmount)]);
          this.amount.updateValueAndValidity({ emitEvent: false });
        },
        error: () => (this.loadError = 'Could not load the recharge options. Please try again.'),
      });

    // The price comes from the server: tax rules and the credits rate are its business, not this screen's.
    this.amount.valueChanges
      .pipe(
        tap((value) => {
          this.selectedPreset = this.options?.presets.includes(value as number) ? (value as number) : null;
          this.quoteError = null;
          if (!this.amount.valid || value == null) {
            this.quote = null;
          }
        }),
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => {
          if (!this.amount.valid || value == null) {
            return of(null);
          }
          this.quoting = true;
          return this.recharge.getQuote(value).pipe(
            catchError((error) => {
              this.quoteError = this.errorMessage(error, 'Could not price that amount.');
              return of(null);
            }),
            finalize(() => (this.quoting = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((quote) => (this.quote = quote));

    this.loadHistory();
  }

  ngOnDestroy(): void {
    this.stopPolling$.next();
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectPreset(value: number): void {
    this.amount.setValue(value);
    this.amount.markAsTouched();
  }

  get canPay(): boolean {
    return !this.processing && !this.quoting && this.amount.valid && this.quote !== null;
  }

  amountError(): string | null {
    const errors = this.amount.errors;
    if (!errors || !this.amount.touched) {
      return null;
    }
    if (errors['required']) {
      return 'Enter an amount.';
    }
    if (errors['min']) {
      return `The smallest recharge is ${formatRupees(this.options?.minAmount ?? 0)}.`;
    }
    if (errors['max']) {
      return `The largest recharge is ${formatRupees(this.options?.maxAmount ?? 0)}.`;
    }
    if (errors['decimals']) {
      return 'Use at most two decimal places.';
    }
    return null;
  }

  // ── Paying ────────────────────────────────────────────────────────────────────────────

  pay(): void {
    const value = this.amount.value;
    if (!this.canPay || value == null) {
      return;
    }

    this.processing = true;
    this.processingMessage = 'Preparing your payment…';
    this.recharge.createOrder(value).subscribe({
      next: (order) => this.openCheckout(order),
      // The error interceptor has already shown the API's own message as a toast.
      error: () => (this.processing = false),
    });
  }

  private openCheckout(order: RechargeCheckout): void {
    this.processingMessage = 'Complete the payment in the Razorpay window…';
    this.checkout.open(this.toCheckout(order)).subscribe({
      next: (event) => {
        if (event.kind === 'success') {
          this.verify(order, event.response);
        } else if (event.kind === 'failed') {
          // Informational: the customer can try again inside the same window. Nothing is decided here.
          this.notify.error(event.response.error.description ?? 'That payment did not go through. You can try again.');
        } else {
          this.closed(order);
        }
      },
      error: (error: Error) => this.fail(error.message),
    });
  }

  /** Checkout's success only tells us Razorpay's identifiers; the server decides whether they are genuine and credits the wallet. */
  private verify(order: RechargeCheckout, response: RazorpaySuccessResponse): void {
    this.processingMessage = 'Confirming your payment…';
    this.recharge
      .verifyPayment({
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      })
      .subscribe({
        next: (result) => this.verified(order, result),
        // The payment may well have gone through even though we could not hear the answer: ask again rather than say it failed.
        error: () => this.pollStatus(order.transactionId),
      });
  }

  private verified(order: RechargeCheckout, result: RechargeVerifyResult): void {
    if (result.success) {
      this.credited(result.transaction, result.balance);
    } else if (result.pending) {
      this.pollStatus(order.transactionId);
    } else {
      this.fail(result.message);
    }
  }

  /** The window was closed without a success callback. A UPI payment can still complete afterwards, so ask the server once before giving up. */
  private closed(order: RechargeCheckout): void {
    this.processingMessage = 'Checking whether the payment went through…';
    timer(2000)
      .pipe(
        switchMap(() => this.recharge.getStatus(order.transactionId)),
        catchError(() => of(null)),
        takeUntil(this.destroy$)
      )
      .subscribe((transaction) => {
        if (transaction?.status === 'Credited') {
          this.credited(transaction, null);
        } else if (transaction?.status === 'Authorized') {
          this.pollStatus(order.transactionId);
        } else {
          this.processing = false;
          this.notify.info('The payment window was closed. If you were charged, your wallet is credited automatically - check the history below.');
          this.loadHistory();
        }
      });
  }

  /** Asks the server for the outcome until it is settled. The server checks with Razorpay itself, so this also covers a closed browser tab on return. */
  private pollStatus(transactionId: string): void {
    this.processingMessage = 'Waiting for the bank to confirm…';
    this.stopPolling$.next();
    let last: RechargeTransaction | null = null;
    timer(0, POLL_EVERY_MS)
      .pipe(
        take(POLL_TIMES),
        switchMap(() => this.recharge.getStatus(transactionId).pipe(catchError(() => of(null)))),
        tap((transaction) => (last = transaction ?? last)),
        takeWhile((transaction) => !transaction || isRechargePending(transaction.status), true),
        takeUntil(this.stopPolling$),
        takeUntil(this.destroy$),
        finalize(() => {
          if (!this.processing) {
            return;
          }
          if (last?.status === 'Credited') {
            this.credited(last, null);
          } else if (last && !isRechargePending(last.status)) {
            this.fail(last.failureReason ?? 'The payment did not go through.');
          } else {
            this.processing = false;
            this.notify.info('Your payment is still being confirmed. Your wallet will be credited automatically - check the history below.');
            this.loadHistory();
          }
        })
      )
      .subscribe();
  }

  /** The only place the wallet balance changes on screen: the server has confirmed the credit. */
  private credited(transaction: RechargeTransaction | null, balance: number | null): void {
    this.processing = false;
    // The wallet holds credits, not rupees: say what was added in the wallet's own unit.
    this.notify.success(transaction ? `${formatCredits(transaction.credits)} added to your wallet.` : 'Your wallet has been credited.');
    if (balance != null && this.options) {
      this.options = { ...this.options, balance };
    } else {
      this.refreshBalance();
    }
    this.entitlements.load(true).subscribe();
    this.amount.reset();
    this.quote = null;
    this.loadHistory();
  }

  private fail(message: string): void {
    this.processing = false;
    this.notify.error(message);
    this.loadHistory();
  }

  private refreshBalance(): void {
    this.recharge.getBalance().subscribe({
      next: ({ balance }) => {
        if (this.options) {
          this.options = { ...this.options, balance };
        }
      },
      error: () => undefined,
    });
  }

  // ── History ───────────────────────────────────────────────────────────────────────────

  loadHistory(): void {
    this.historyLoading = true;
    this.recharge
      .getHistory({ page: this.page, pageSize: this.pageSize })
      .pipe(
        finalize(() => (this.historyLoading = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({ next: (page) => (this.history = page), error: () => undefined });
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadHistory();
  }

  /** For a top-up still waiting: the server asks Razorpay and settles it, so a payment made with the browser closed shows up here. */
  checkStatus(row: RechargeTransaction): void {
    this.recharge.getStatus(row.id).subscribe({
      next: (fresh) => {
        this.history = { ...this.history, items: this.history.items.map((t) => (t.id === fresh.id ? fresh : t)) };
        if (fresh.status === 'Credited' && row.status !== 'Credited') {
          this.notify.success(`${formatCredits(fresh.credits)} added to your wallet.`);
          this.refreshBalance();
          this.entitlements.load(true).subscribe();
        }
      },
      error: () => this.notify.error('Could not check that payment right now.'),
    });
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

  /** The API's own words where it gave any (a validation message, or a conflict such as "online payment is not set up"). */
  private errorMessage(error: { error?: { detail?: string; title?: string; errors?: Record<string, string[]> } }, fallback: string): string {
    const body = error?.error;
    return (body?.errors ? Object.values(body.errors)[0]?.[0] : undefined) ?? body?.detail ?? body?.title ?? fallback;
  }
}
