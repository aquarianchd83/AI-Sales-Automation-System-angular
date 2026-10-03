import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Subscription, forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  RAZORPAY_CURRENCIES,
  RazorpayCheckResult,
  RazorpayCheckout,
  RazorpayOrder,
  RazorpaySettings,
  RazorpayStep,
  RazorpayWebhookEvent,
  formatMinor,
} from '../../core/models/razorpay.model';
import { NotificationService } from '../../core/services/notification.service';
import { RazorpayCheckoutService } from '../../core/services/razorpay-checkout.service';
import { RazorpayTestService } from '../../core/services/razorpay-test.service';

/** One line of the live log of the current payment. */
export interface FlowStep {
  label: string;
  state: 'ok' | 'fail' | 'info' | 'busy';
  detail?: string | null;
}

/**
 * The Platform Admin Console's Razorpay test page: save the platform's Razorpay keys, make a real (test-mode) payment through Razorpay
 * Checkout, and watch the server prove it - signature, Razorpay's own record, capture - then refund it and see the signed webhooks
 * arrive. Deliberately not connected to tenant billing.
 */
@Component({
  selector: 'app-razorpay-test-page',
  templateUrl: './razorpay-test-page.component.html',
  styleUrls: ['./razorpay-test-page.component.scss'],
})
export class RazorpayTestPageComponent implements OnInit, OnDestroy {
  readonly currencies = RAZORPAY_CURRENCIES;
  readonly format = formatMinor;

  readonly keysForm = this.fb.group({
    keyId: ['', [Validators.pattern(/^rzp_(test|live)_[A-Za-z0-9]{6,40}$/)]],
    keySecret: '',
    removeKeySecret: false,
    webhookSecret: '',
    removeWebhookSecret: false,
  });

  readonly payForm = this.fb.group({
    amount: [1, [Validators.required, Validators.min(1), Validators.max(500000)]],
    currency: 'INR',
    description: ['Platform test payment', [Validators.maxLength(255)]],
    customerName: '',
    customerEmail: ['', [Validators.email]],
    customerContact: ['', [Validators.pattern(/^\s*\+?[0-9 ()-]{8,20}\s*$/)]],
  });

  /** Refund amount for the selected order, in rupees; blank refunds what is left. */
  readonly refundAmount = new FormControl<number | null>(null, [Validators.min(0.01)]);

  settings: RazorpaySettings | null = null;
  orders: RazorpayOrder[] = [];
  events: RazorpayWebhookEvent[] = [];
  loading = true;
  loadFailed = false;
  savingKeys = false;
  testingKeys = false;
  keyTest: RazorpayCheckResult | null = null;
  paying = false;
  flow: FlowStep[] = [];
  flowOutcome: { success: boolean; message: string } | null = null;
  refunding: RazorpayOrder | null = null;
  refundBusy = false;
  refreshing = false;

  private checkoutSub: Subscription | null = null;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly api: RazorpayTestService,
    private readonly checkout: RazorpayCheckoutService,
    private readonly notify: NotificationService
  ) {}

  /** Where to point Razorpay's webhook: the API is served from this origin under /api. */
  get webhookUrl(): string {
    return `${window.location.origin}${this.settings?.webhookPath ?? '/api/v1/webhooks/razorpay'}`;
  }

  get typedMode(): 'test' | 'live' | null {
    const keyId = this.keysForm.controls.keyId.value;
    return keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : null;
  }

  ngOnInit(): void {
    this.load();
    this.keysForm.valueChanges.subscribe(() => (this.keyTest = null));
  }

  ngOnDestroy(): void {
    this.checkoutSub?.unsubscribe();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    forkJoin({ settings: this.api.getSettings(), orders: this.api.getOrders(), events: this.api.getWebhookEvents() })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ settings, orders, events }) => {
          this.applySettings(settings);
          this.orders = orders;
          this.events = events;
        },
        error: () => (this.loadFailed = true),
      });
  }

  /** Reloads the orders and the webhook log - webhooks arrive a few seconds after a payment. */
  refresh(): void {
    this.refreshing = true;
    forkJoin({ orders: this.api.getOrders(), events: this.api.getWebhookEvents() })
      .pipe(finalize(() => (this.refreshing = false)))
      .subscribe({
        next: ({ orders, events }) => {
          this.orders = orders;
          this.events = events;
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  // ── Keys ──────────────────────────────────────────────────────────────────────────

  hint(kind: 'key' | 'webhook'): string | null {
    if (!this.settings) {
      return null;
    }
    return kind === 'key'
      ? this.settings.hasKeySecret ? this.settings.keySecretHint ?? 'set' : null
      : this.settings.hasWebhookSecret ? this.settings.webhookSecretHint ?? 'set' : null;
  }

  saveKeys(): void {
    if (this.savingKeys || this.keysForm.pristine) {
      return;
    }
    this.keysForm.markAllAsTouched();
    if (this.keysForm.invalid) {
      return;
    }
    const raw = this.keysForm.getRawValue();
    this.savingKeys = true;
    this.api
      .saveSettings({
        keyId: raw.keyId.trim(),
        keySecret: raw.removeKeySecret ? '' : raw.keySecret.trim() || null,
        webhookSecret: raw.removeWebhookSecret ? '' : raw.webhookSecret.trim() || null,
      })
      .pipe(finalize(() => (this.savingKeys = false)))
      .subscribe({
        next: (settings) => {
          this.applySettings(settings);
          this.notify.success('Razorpay keys saved.');
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Tests what is on screen; a blank secret tests the stored one. */
  testKeys(): void {
    const keyId = this.keysForm.controls.keyId.value.trim();
    if (this.testingKeys || !keyId || this.keysForm.controls.keyId.invalid) {
      this.keysForm.controls.keyId.markAsTouched();
      return;
    }
    this.testingKeys = true;
    this.keyTest = null;
    this.api
      .testKeys(keyId, this.keysForm.controls.keySecret.value.trim() || null)
      .pipe(finalize(() => (this.testingKeys = false)))
      .subscribe({
        next: (result) => (this.keyTest = result),
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  async copyWebhookUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.webhookUrl);
      this.notify.success('Webhook URL copied.');
    } catch {
      this.notify.error('Could not copy - select the address and copy it.');
    }
  }

  // ── Paying ────────────────────────────────────────────────────────────────────────

  pay(): void {
    if (this.paying) {
      return;
    }
    this.payForm.markAllAsTouched();
    if (this.payForm.invalid) {
      return;
    }
    if (!this.settings?.isConfigured) {
      this.notify.error('Save the key id and key secret first.');
      return;
    }

    const raw = this.payForm.getRawValue();
    const amount = Math.round(Number(raw.amount) * 100) / 100;
    this.paying = true;
    this.flowOutcome = null;
    this.flow = [{ label: 'Creating the order at Razorpay', state: 'busy' }];

    this.api
      .createOrder({
        amount,
        currency: raw.currency,
        description: raw.description.trim() || null,
        customerName: raw.customerName.trim() || null,
        customerEmail: raw.customerEmail.trim() || null,
        customerContact: raw.customerContact.trim() || null,
      })
      .subscribe({
        next: (order) => {
          this.flow = [
            { label: 'Order created at Razorpay', state: 'ok', detail: `${order.orderId} · ${formatMinor(order.amount, order.currency)} · ${order.mode} mode` },
            { label: 'Razorpay Checkout open - complete or close the payment window', state: 'busy' },
          ];
          this.openCheckout(order);
          this.refresh();
        },
        error: () => {
          this.paying = false;
          this.flow = [{ label: 'Order could not be created', state: 'fail' }];
        },
      });
  }

  private openCheckout(order: RazorpayCheckout): void {
    this.checkoutSub?.unsubscribe();
    this.checkoutSub = this.checkout.open(order).subscribe({
      next: (event) => {
        if (event.kind === 'failed') {
          const e = event.response.error ?? {};
          this.replaceBusy({ label: 'Attempt failed in Checkout (you can retry in the same window)', state: 'fail', detail: [e.code, e.description, e.reason].filter(Boolean).join(' - ') });
          this.flow.push({ label: 'Razorpay Checkout still open', state: 'busy' });
          this.api
            .reportFailure(order.id, { paymentId: e.metadata?.payment_id ?? null, code: e.code ?? null, description: e.description ?? null, reason: e.reason ?? null })
            .subscribe({ next: () => this.refresh(), error: () => undefined });
        } else if (event.kind === 'dismissed') {
          this.replaceBusy({ label: 'Checkout closed without completing a payment', state: 'info' });
          this.paying = false;
          this.refresh();
        } else {
          this.replaceBusy({ label: 'Checkout returned a payment', state: 'ok', detail: event.response.razorpay_payment_id });
          this.flow.push({ label: 'Verifying on the server', state: 'busy' });
          this.api
            .verify(order.id, event.response)
            .pipe(finalize(() => (this.paying = false)))
            .subscribe({
              next: (result) => {
                this.flow = this.flow.filter((s) => s.state !== 'busy').concat(result.steps.map((s: RazorpayStep) => this.fromServer(s)));
                this.flowOutcome = { success: result.success, message: result.message };
                this.refresh();
              },
              error: () => this.replaceBusy({ label: 'The server could not verify the payment', state: 'fail' }),
            });
        }
      },
      error: (error: unknown) => {
        this.paying = false;
        this.replaceBusy({ label: 'Razorpay Checkout could not open', state: 'fail', detail: error instanceof Error ? error.message : String(error) });
      },
    });
  }

  // ── Refunds ───────────────────────────────────────────────────────────────────────

  canRefund(order: RazorpayOrder): boolean {
    return (order.status === 'Paid' || order.status === 'PartiallyRefunded') && !!order.paymentId;
  }

  startRefund(order: RazorpayOrder): void {
    this.refunding = order;
    this.refundAmount.reset(null);
  }

  cancelRefund(): void {
    this.refunding = null;
  }

  confirmRefund(): void {
    const order = this.refunding;
    if (!order || this.refundBusy || this.refundAmount.invalid) {
      return;
    }
    const value = this.refundAmount.value;
    const amount = value === null || `${value}`.trim() === '' ? null : Math.round(Number(value) * 100) / 100;
    const left = (order.amountMinor - order.refundedMinor) / 100;
    if (amount !== null && amount > left) {
      this.notify.error(`At most ${formatMinor(order.amountMinor - order.refundedMinor, order.currency)} is left to refund.`);
      return;
    }

    this.refundBusy = true;
    this.api
      .refund(order.id, amount)
      .pipe(finalize(() => (this.refundBusy = false)))
      .subscribe({
        next: (updated) => {
          this.orders = this.orders.map((o) => (o.id === updated.id ? updated : o));
          this.refunding = null;
          this.notify.success(`Refunded - ${formatMinor(updated.refundedMinor, updated.currency)} in all.`);
          this.refresh();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  statusClass(status: string): string {
    return 'status--' + status.toLowerCase();
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  private fromServer(step: RazorpayStep): FlowStep {
    return { label: step.label, state: step.ok ? 'ok' : 'fail', detail: step.detail };
  }

  private replaceBusy(step: FlowStep): void {
    const index = this.flow.findIndex((s) => s.state === 'busy');
    if (index >= 0) {
      this.flow[index] = step;
    } else {
      this.flow.push(step);
    }
  }

  private applySettings(settings: RazorpaySettings): void {
    this.settings = settings;
    this.keysForm.reset({ keyId: settings.keyId, keySecret: '', removeKeySecret: false, webhookSecret: '', removeWebhookSecret: false });
  }
}
