import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { emptyPage } from '../../../core/models/paged-result.model';
import {
  RechargeCheckout,
  RechargeOptions,
  RechargeQuote,
  RechargeTransaction,
  RechargeVerifyResult,
} from '../../../core/models/wallet-recharge.model';
import { CheckoutEvent, RazorpayCheckoutService } from '../../../core/services/razorpay-checkout.service';
import { EntitlementsService } from '../../../core/services/entitlements.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WalletRechargeService } from '../../../core/services/wallet-recharge.service';
import { SharedModule } from '../../../shared/shared.module';
import { WalletRechargeComponent } from './wallet-recharge.component';

const OPTIONS: RechargeOptions = { currency: 'INR', minAmount: 100, maxAmount: 50000, creditsPerRupee: 1, presets: [100, 500, 1000, 2000, 5000], balance: 1000 };

const quoteFor = (amount: number): RechargeQuote => ({
  amount,
  tax: amount * 0.18,
  total: amount * 1.18,
  currency: 'INR',
  taxLines: [{ name: 'GST', ratePercent: 18, amount: amount * 0.18 }],
  credits: amount,
  balanceBefore: 1000,
  balanceAfter: 1000 + amount,
});

const ORDER: RechargeCheckout = {
  transactionId: 'txn-1',
  reference: 'wr-1',
  orderId: 'order_1',
  keyId: 'rzp_test_abc',
  mode: 'test',
  amountMinor: 59000,
  currency: 'INR',
  businessName: 'Sales Automation',
  description: 'Wallet recharge',
  amount: 500,
  tax: 90,
  total: 590,
  credits: 500,
  prefill: { name: 'Acme', email: null, contact: null },
};

const TXN = (status: RechargeTransaction['status']): RechargeTransaction => ({
  id: 'txn-1',
  reference: 'wr-1',
  razorpayOrderId: 'order_1',
  razorpayPaymentId: status === 'Credited' ? 'pay_1' : null,
  amount: 500,
  tax: 90,
  total: 590,
  currency: 'INR',
  credits: 500,
  status,
  paymentMethod: 'upi',
  failureReason: null,
  mode: 'test',
  balanceBefore: 1000,
  balanceAfter: status === 'Credited' ? 1500 : null,
  createdAt: '2026-11-21T09:00:00',
  capturedAt: null,
  creditedAt: null,
});

describe('WalletRechargeComponent', () => {
  let fixture: ComponentFixture<WalletRechargeComponent>;
  let component: WalletRechargeComponent;
  let recharge: jasmine.SpyObj<WalletRechargeService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let entitlements: { load: jasmine.Spy };
  let checkoutEvents: Observable<CheckoutEvent>;
  let opened: jasmine.Spy;

  function setup(): void {
    recharge = jasmine.createSpyObj<WalletRechargeService>('WalletRechargeService', ['getOptions', 'getQuote', 'getBalance', 'createOrder', 'verifyPayment', 'getStatus', 'getHistory']);
    recharge.getOptions.and.returnValue(of(OPTIONS));
    recharge.getQuote.and.callFake((amount: number) => of(quoteFor(amount)));
    recharge.getBalance.and.returnValue(of({ balance: 1500, unit: 'credits' }));
    recharge.createOrder.and.returnValue(of(ORDER));
    recharge.getHistory.and.returnValue(of(emptyPage<RechargeTransaction>()));
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success', 'error', 'info']);
    entitlements = { load: jasmine.createSpy('load').and.returnValue(of(null)) };
    opened = jasmine.createSpy('open').and.callFake(() => checkoutEvents);

    TestBed.configureTestingModule({
      declarations: [WalletRechargeComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: WalletRechargeService, useValue: recharge },
        { provide: RazorpayCheckoutService, useValue: { open: opened } },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(WalletRechargeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  /** Picks an amount and lets the debounced server quote arrive. */
  function choose(amount: number): void {
    component.selectPreset(amount);
    tick(350);
    fixture.detectChanges();
  }

  const success = (): CheckoutEvent => ({ kind: 'success', response: { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' } });
  const verifyResult = (over: Partial<RechargeVerifyResult>): RechargeVerifyResult => ({ success: false, pending: false, message: '', transaction: null, balance: null, ...over });

  it('shows the balance before payment and the quick-pick amounts, and prices an amount on the server', fakeAsync(() => {
    setup();
    choose(500);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('1,000 credits');
    expect(fixture.nativeElement.querySelectorAll('.preset').length).toBe(5);
    expect(recharge.getQuote).toHaveBeenCalledWith(500);
    expect(fixture.nativeElement.querySelector('[data-testid="quote-total"]').textContent).toContain('590');
    expect(component.canPay).toBeTrue();
  }));

  it('refuses amounts outside the configured limits and does not enable Pay', fakeAsync(() => {
    setup();
    component.amount.setValue(50);
    component.amount.markAsTouched();
    tick(350);
    fixture.detectChanges();

    expect(component.amount.hasError('min')).toBeTrue();
    expect(component.amountError()).toContain('smallest');
    expect(component.canPay).toBeFalse();
    expect(recharge.getQuote).not.toHaveBeenCalled();

    component.amount.setValue(60000);
    expect(component.amount.hasError('max')).toBeTrue();
    component.amount.setValue(100.555);
    expect(component.amount.hasError('decimals')).toBeTrue();
    tick(350); // let the debounced price request settle
  }));

  it('credits nothing on Checkout\'s success callback alone: the balance changes only after the server confirms', fakeAsync(() => {
    setup();
    let release!: (r: RechargeVerifyResult) => void;
    checkoutEvents = of(success());
    recharge.verifyPayment.and.returnValue(new Observable<RechargeVerifyResult>((s) => { release = (r) => { s.next(r); s.complete(); }; }));
    choose(500);

    component.pay();
    tick();

    expect(recharge.createOrder).toHaveBeenCalledWith(500);
    expect(recharge.verifyPayment).toHaveBeenCalledWith({ razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' });
    expect(component.processing).toBeTrue();
    expect(component.options!.balance).toBe(1000);
    expect(notify.success).not.toHaveBeenCalled();

    release(verifyResult({ success: true, transaction: TXN('Credited'), balance: 1500 }));
    tick();

    expect(component.processing).toBeFalse();
    expect(component.options!.balance).toBe(1500);
    expect(notify.success).toHaveBeenCalled();
    expect(entitlements.load).toHaveBeenCalledWith(true);
    expect(recharge.getHistory).toHaveBeenCalledTimes(2);
    tick(350); // resetting the amount schedules a (debounced) price check
  }));

  it('keeps waiting, and polls the server, when the payment is genuine but not confirmed yet', fakeAsync(() => {
    setup();
    checkoutEvents = of(success());
    recharge.verifyPayment.and.returnValue(of(verifyResult({ pending: true })));
    let calls = 0;
    recharge.getStatus.and.callFake(() => of(TXN(++calls < 3 ? 'Authorized' : 'Credited')));
    choose(500);

    component.pay();
    tick(0);
    expect(component.processing).toBeTrue();
    tick(3000 * 3);
    flush();

    expect(recharge.getStatus).toHaveBeenCalledWith('txn-1');
    expect(component.processing).toBeFalse();
    expect(notify.success).toHaveBeenCalled();
    expect(recharge.getBalance).toHaveBeenCalled(); // the balance is read again from the server
    expect(component.options!.balance).toBe(1500);
  }));

  it('reports a failed verification and leaves the balance alone', fakeAsync(() => {
    setup();
    checkoutEvents = of(success());
    recharge.verifyPayment.and.returnValue(of(verifyResult({ message: 'The payment could not be verified: the signature does not match.' })));
    choose(500);

    component.pay();
    tick();

    expect(notify.error).toHaveBeenCalledWith('The payment could not be verified: the signature does not match.');
    expect(component.processing).toBeFalse();
    expect(component.options!.balance).toBe(1000);
    expect(notify.success).not.toHaveBeenCalled();
  }));

  it('asks the server once when Checkout is closed, and says nothing was lost if it was not paid', fakeAsync(() => {
    setup();
    checkoutEvents = of<CheckoutEvent>({ kind: 'dismissed' });
    recharge.getStatus.and.returnValue(of(TXN('Created')));
    choose(500);

    component.pay();
    tick(2500);

    expect(recharge.getStatus).toHaveBeenCalledWith('txn-1');
    expect(recharge.verifyPayment).not.toHaveBeenCalled();
    expect(notify.info).toHaveBeenCalled();
    expect(component.processing).toBeFalse();
    expect(component.options!.balance).toBe(1000);
  }));

  it('credits when Checkout was closed but the payment had in fact completed', fakeAsync(() => {
    setup();
    checkoutEvents = of<CheckoutEvent>({ kind: 'dismissed' });
    recharge.getStatus.and.returnValue(of(TXN('Credited')));
    choose(500);

    component.pay();
    tick(2500);

    expect(notify.success).toHaveBeenCalled();
    expect(component.options!.balance).toBe(1500);
  }));

  it('does not start a second payment while one is in progress', fakeAsync(() => {
    setup();
    checkoutEvents = new Observable<CheckoutEvent>(() => undefined); // Checkout stays open
    choose(500);

    component.pay();
    tick();
    component.pay();
    tick();

    expect(recharge.createOrder).toHaveBeenCalledTimes(1);
    expect(component.canPay).toBeFalse();
  }));

  it('stops the processing indicator when the order cannot be created', fakeAsync(() => {
    setup();
    recharge.createOrder.and.returnValue(throwError(() => ({ status: 409 })));
    choose(500);

    component.pay();
    tick();

    expect(component.processing).toBeFalse();
    expect(opened).not.toHaveBeenCalled();
  }));

  it('lets a tenant check a waiting top-up from the history and refreshes the balance when it turns out paid', fakeAsync(() => {
    setup();
    recharge.getStatus.and.returnValue(of(TXN('Credited')));
    component.history = { items: [TXN('Created')], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 };

    component.checkStatus(component.history.items[0]);
    tick();

    expect(component.history.items[0].status).toBe('Credited');
    expect(notify.success).toHaveBeenCalled();
    expect(recharge.getBalance).toHaveBeenCalled();
  }));
});
