import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { CreditPack, QuotaType } from '../../../core/models/billing.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { BillingService } from '../../../core/services/billing.service';
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

/** The purchase itself, end to end at the screen: confirm first, charge once, refresh what's shown. */
describe('WalletComponent buying credits', () => {
  function setup(options: { confirmed: boolean; purchaseFails?: boolean }) {
    const billing = {
      getQuota: jasmine.createSpy('getQuota').and.returnValue(of([{ quotaType: QuotaType.Credits, balance: 500, capacity: 500, grants: [] }])),
      getWallet: jasmine.createSpy('getWallet').and.returnValue(of({ balance: 500, planCode: 'premium', planName: 'Premium', monthlyCredits: 100, monthStartUtc: '', features: [] })),
      getCreditPacks: () => of([PACK]),
      getSubscription: () => of({ planId: 'plan-1', planName: 'Premium', status: 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null }),
      getAlertSettings: () => of({ email: null, phoneE164: null, whatsAppEnabled: false }),
      getLedger: jasmine.createSpy('getLedger').and.returnValue(of(emptyPage())),
      getAiUsage: jasmine.createSpy('getAiUsage').and.returnValue(of(emptyPage())),
      purchaseCreditPack: jasmine
        .createSpy('purchaseCreditPack')
        .and.callFake(() => (options.purchaseFails ? throwError(() => new Error('409')) : of({ id: 'pay-1' }))),
    };
    const dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(options.confirmed) }) };
    const notify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), info: jasmine.createSpy('info') };
    const entitlements = { load: jasmine.createSpy('load').and.returnValue(of(null)) };

    TestBed.configureTestingModule({
      declarations: [WalletComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
        { provide: EntitlementsService, useValue: entitlements },
      ],
    });

    const fixture = TestBed.createComponent(WalletComponent);
    fixture.detectChanges();
    const buy = () => (fixture.nativeElement.querySelector('.pack-row button') as HTMLButtonElement).click();
    return { fixture, billing, dialog, notify, entitlements, buy };
  }

  it('asks for confirmation naming the pack, the price and the 12-month validity before charging anything', () => {
    const { dialog, billing, buy } = setup({ confirmed: false });

    buy();

    const data = dialog.open.calls.mostRecent().args[1].data;
    expect(data.title).toContain('500 credits');
    expect(data.message).toContain('₹1,660');
    expect(data.message).toContain('12 months');
    expect(billing.purchaseCreditPack).not.toHaveBeenCalled();
  });

  it('charges once on confirm, tells the tenant, and refreshes the balance, history and entitlements', () => {
    const { billing, notify, entitlements, buy } = setup({ confirmed: true });
    const walletCallsBefore = billing.getWallet.calls.count();
    const ledgerCallsBefore = billing.getLedger.calls.count();

    buy();

    expect(billing.purchaseCreditPack).toHaveBeenCalledOnceWith('pack-1');
    expect(notify.success).toHaveBeenCalledWith('500 credits added.');
    expect(billing.getWallet.calls.count()).toBe(walletCallsBefore + 1);
    expect(billing.getLedger.calls.count()).toBe(ledgerCallsBefore + 1);
    expect(entitlements.load).toHaveBeenCalledWith(true);
  });

  it('leaves everything alone and frees the button again when the purchase is refused', () => {
    const { fixture, billing, notify, buy } = setup({ confirmed: true, purchaseFails: true });
    const walletCallsBefore = billing.getWallet.calls.count();

    buy();
    fixture.detectChanges();

    expect(notify.success).not.toHaveBeenCalled();
    expect(billing.getWallet.calls.count()).toBe(walletCallsBefore);
    expect((fixture.nativeElement.querySelector('.pack-row button') as HTMLButtonElement).disabled).toBeFalse();
  });
});
