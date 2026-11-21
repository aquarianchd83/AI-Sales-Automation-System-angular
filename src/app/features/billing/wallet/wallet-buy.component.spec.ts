import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';

import { CreditPack, QuotaType } from '../../../core/models/billing.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { RechargeCheckout } from '../../../core/models/wallet-recharge.model';
import { BillingService } from '../../../core/services/billing.service';
import { RazorpayPaymentFlowService, RazorpayPaymentOutcome } from '../../../core/services/razorpay-payment-flow.service';
import { WalletRechargeService } from '../../../core/services/wallet-recharge.service';
import { EntitlementsService } from '../../../core/services/entitlements.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { WalletComponent } from './wallet.component';

const PACK: CreditPack = {
  id: 'pack-1',
  quotaType: QuotaType.Credits,
  name: '500 credits',
  units: 500,
  priceCents: 1200,
  currencyCode: 'INR',
  currencySymbol: '₹',
  localPriceAmount: 1660,
  taxLines: [],
  taxLocal: 0,
  totalLocal: 1660,
};

const ORDER: RechargeCheckout = {
  transactionId: 'txn-1', reference: 'wr-1', orderId: 'order_1', keyId: 'rzp_test_1', mode: 'test', amountMinor: 195_880, currency: 'INR',
  businessName: 'AiSaarthi', description: '500 credits', amount: 1660, tax: 298.8, total: 1958.8, credits: 500, prefill: { name: 'Acme', email: null, contact: null },
};

/** Buying a pack, end to end at the screen: confirm, pay through Razorpay, and only refresh what's shown once the server says the credits are in. */
describe('WalletComponent buying credits', () => {
  function setup(options: { confirmed: boolean; orderFails?: boolean; outcome?: Observable<RazorpayPaymentOutcome> }) {
    const billing = {
      getQuota: jasmine.createSpy('getQuota').and.returnValue(of([{ quotaType: QuotaType.Credits, balance: 500, capacity: 500, grants: [] }])),
      getWallet: jasmine.createSpy('getWallet').and.returnValue(of({ balance: 500, planCode: 'premium', planName: 'Premium', monthlyCredits: 100, monthStartUtc: '', features: [] })),
      getCreditPacks: () => of([PACK]),
      getSubscription: () => of({ planId: 'plan-1', planName: 'Premium', status: 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null }),
      getAlertSettings: () => of({ email: null, phoneE164: null, whatsAppEnabled: false }),
      getLedger: jasmine.createSpy('getLedger').and.returnValue(of(emptyPage())),
      getAiUsage: jasmine.createSpy('getAiUsage').and.returnValue(of(emptyPage())),
      purchaseCreditPack: jasmine.createSpy('purchaseCreditPack'),
    };
    const recharge = {
      createPackOrder: jasmine.createSpy('createPackOrder').and.callFake(() => (options.orderFails ? throwError(() => ({ status: 409 })) : of(ORDER))),
    };
    const payments = {
      pay: jasmine.createSpy('pay').and.callFake(() => options.outcome ?? of<RazorpayPaymentOutcome>({ kind: 'credited', transaction: null, balance: 1000 })),
    };
    const dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(options.confirmed) }) };
    const notify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), info: jasmine.createSpy('info') };
    const entitlements = { load: jasmine.createSpy('load').and.returnValue(of(null)) };

    TestBed.configureTestingModule({
      declarations: [WalletComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: WalletRechargeService, useValue: recharge },
        { provide: RazorpayPaymentFlowService, useValue: payments },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    });

    const fixture = TestBed.createComponent(WalletComponent);
    fixture.detectChanges();
    const buy = () => (fixture.nativeElement.querySelector('.pack-row button') as HTMLButtonElement).click();
    return { fixture, billing, recharge, payments, dialog, notify, entitlements, buy };
  }

  it('asks for confirmation naming the pack, the price, Razorpay and the 12-month validity before anything is ordered', () => {
    const { dialog, recharge, buy } = setup({ confirmed: false });

    buy();

    const data = dialog.open.calls.mostRecent().args[1].data;
    expect(data.title).toContain('500 credits');
    expect(data.message).toContain('₹1,660');
    expect(data.message).toContain('Razorpay');
    expect(data.message).toContain('12 months');
    expect(recharge.createPackOrder).not.toHaveBeenCalled();
  });

  it('pays through Razorpay on confirm, never the old simulated purchase, and refreshes once the server says the credits are in', () => {
    const { billing, recharge, payments, notify, entitlements, buy } = setup({ confirmed: true });
    const walletCallsBefore = billing.getWallet.calls.count();
    const ledgerCallsBefore = billing.getLedger.calls.count();

    buy();

    expect(recharge.createPackOrder).toHaveBeenCalledOnceWith('pack-1');
    expect(payments.pay).toHaveBeenCalledOnceWith(ORDER);
    expect(billing.purchaseCreditPack).not.toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalledWith('500 credits added to your wallet.');
    expect(billing.getWallet.calls.count()).toBe(walletCallsBefore + 1);
    expect(billing.getLedger.calls.count()).toBe(ledgerCallsBefore + 1);
    expect(entitlements.load).toHaveBeenCalledWith(true);
  });

  it('does not touch the balance while the payment is only pending, and says it will be credited', () => {
    const { billing, notify, buy } = setup({ confirmed: true, outcome: of<RazorpayPaymentOutcome>({ kind: 'pending' }) });
    const walletCallsBefore = billing.getWallet.calls.count();

    buy();

    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.info).toHaveBeenCalled();
    expect(billing.getWallet.calls.count()).toBe(walletCallsBefore);
  });

  it('shows why a payment failed and adds nothing', () => {
    const { billing, notify, buy } = setup({ confirmed: true, outcome: of<RazorpayPaymentOutcome>({ kind: 'failed', message: 'Bank declined' }) });
    const walletCallsBefore = billing.getWallet.calls.count();

    buy();

    expect(notify.error).toHaveBeenCalledWith('Bank declined');
    expect(billing.getWallet.calls.count()).toBe(walletCallsBefore);
  });

  it('leaves everything alone and frees the button again when the order is refused', () => {
    const { fixture, billing, payments, notify, buy } = setup({ confirmed: true, orderFails: true });
    const walletCallsBefore = billing.getWallet.calls.count();

    buy();
    fixture.detectChanges();

    expect(payments.pay).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(billing.getWallet.calls.count()).toBe(walletCallsBefore);
    expect((fixture.nativeElement.querySelector('.pack-row button') as HTMLButtonElement).disabled).toBeFalse();
  });
});
