import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { CreditPack, QuotaType } from '../../../core/models/billing.model';
import { emptyPage } from '../../../core/models/paged-result.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { WalletComponent } from './wallet.component';

const PACK: CreditPack = {
  id: 'pack-1',
  quotaType: QuotaType.WhatsAppMessages,
  name: '1,000 WhatsApp messages',
  units: 1000,
  priceCents: 2000,
  currencyCode: 'INR',
  currencySymbol: '₹',
  localPriceAmount: 1660,
};

/** The purchase itself, end to end at the screen: confirm first, charge once, refresh what's shown. */
describe('WalletComponent buying credits', () => {
  function setup(options: { confirmed: boolean; purchaseFails?: boolean }) {
    const billing = {
      getQuota: jasmine.createSpy('getQuota').and.returnValue(of([{ quotaType: QuotaType.WhatsAppMessages, balance: 500, capacity: 500, grants: [] }])),
      getCreditPacks: () => of([PACK]),
      getSubscription: () => of({ planId: 'plan-1', planName: 'Starter', status: 'Active', currentPeriodStartUtc: null, currentPeriodEndUtc: null }),
      getNotifications: () => of([]),
      getAlertSettings: () => of({ email: null, phoneE164: null, whatsAppEnabled: false }),
      getLedger: jasmine.createSpy('getLedger').and.returnValue(of(emptyPage())),
      acknowledgeNotification: () => of(void 0),
      purchaseCreditPack: jasmine
        .createSpy('purchaseCreditPack')
        .and.callFake(() => (options.purchaseFails ? throwError(() => new Error('409')) : of({ id: 'pay-1' }))),
    };
    const dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(options.confirmed) }) };
    const notify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), info: jasmine.createSpy('info') };

    TestBed.configureTestingModule({
      declarations: [WalletComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: BillingService, useValue: billing },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(WalletComponent);
    fixture.detectChanges();
    const buy = () => (fixture.nativeElement.querySelector('.pack-row button') as HTMLButtonElement).click();
    return { fixture, billing, dialog, notify, buy };
  }

  it('asks for confirmation naming the pack, the price and the 12-month validity before charging anything', () => {
    const { dialog, billing, buy } = setup({ confirmed: false });

    buy();

    const data = dialog.open.calls.mostRecent().args[1].data;
    expect(data.title).toContain('1,000 WhatsApp messages');
    expect(data.message).toContain('₹1,660');
    expect(data.message).toContain('12 months');
    expect(billing.purchaseCreditPack).not.toHaveBeenCalled();
  });

  it('charges once on confirm, tells the tenant, and refreshes the balance and history', () => {
    const { billing, notify, buy } = setup({ confirmed: true });
    const quotaCallsBefore = billing.getQuota.calls.count();
    const ledgerCallsBefore = billing.getLedger.calls.count();

    buy();

    expect(billing.purchaseCreditPack).toHaveBeenCalledOnceWith('pack-1');
    expect(notify.success).toHaveBeenCalledWith('1,000 WhatsApp messages added.');
    expect(billing.getQuota.calls.count()).toBe(quotaCallsBefore + 1);
    expect(billing.getLedger.calls.count()).toBe(ledgerCallsBefore + 1);
  });

  it('leaves everything alone and frees the button again when the purchase is refused', () => {
    const { fixture, billing, notify, buy } = setup({ confirmed: true, purchaseFails: true });
    const quotaCallsBefore = billing.getQuota.calls.count();

    buy();
    fixture.detectChanges();

    expect(notify.success).not.toHaveBeenCalled();
    expect(billing.getQuota.calls.count()).toBe(quotaCallsBefore);
    expect((fixture.nativeElement.querySelector('.pack-row button') as HTMLButtonElement).disabled).toBeFalse();
  });
});
