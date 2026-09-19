import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { QuotaType } from '../../../core/models/billing.model';
import { PlatformCreditPack } from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { CountryPriceEditorComponent, newCountryPriceRow } from '../country-price-editor/country-price-editor.component';
import { PlatformCreditPackFormDialogComponent } from './platform-credit-pack-form-dialog.component';

const pack: PlatformCreditPack = {
  id: 'cp1',
  quotaType: QuotaType.AiConversations,
  name: '1,000 AI conversations',
  units: 1000,
  priceCents: 1400,
  isActive: true,
  currencyCode: 'USD',
  currencySymbol: '$',
  priceLocal: 14,
  countryPrices: [],
};

const REGIONS = [
  { countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹' },
  { countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£' },
];


describe('PlatformCreditPackFormDialogComponent', () => {
  function create(existing: PlatformCreditPack | null) {
    const billing = {
      createCreditPack: jasmine.createSpy('createCreditPack').and.returnValue(of(pack)),
      updateCreditPack: jasmine.createSpy('updateCreditPack').and.returnValue(of(pack)),
    };
    const dialogRef = { close: jasmine.createSpy('close') };

    TestBed.configureTestingModule({
      declarations: [PlatformCreditPackFormDialogComponent, CountryPriceEditorComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformBillingService, useValue: billing },
        { provide: BillingService, useValue: { getRegions: () => of(REGIONS) } },
        { provide: NotificationService, useValue: { success: () => {} } },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { pack: existing } },
      ],
    });

    const fixture = TestBed.createComponent(PlatformCreditPackFormDialogComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, billing, dialogRef };
  }

  it('creates a pack, converting dollars to cents', () => {
    const { component, billing, dialogRef } = create(null);

    component.form.patchValue({ quotaType: QuotaType.LeadCandidates, name: ' 500 leads ', units: 500, priceDollars: 9.99 });
    component.save();

    expect(billing.createCreditPack).toHaveBeenCalledWith({
      quotaType: QuotaType.LeadCandidates,
      name: '500 leads',
      units: 500,
      priceCents: 999,
      countryPrices: [],
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('will not save a pack with no price or a blank name', () => {
    const { component, billing } = create(null);

    component.form.patchValue({ name: '', priceDollars: 0 });
    component.save();

    expect(billing.createCreditPack).not.toHaveBeenCalled();
  });

  it('sends a country price along with the pack', () => {
    const { component, billing } = create(null);

    component.form.patchValue({ name: 'Leads', units: 500, priceDollars: 9 });
    component.countryPrices.push(newCountryPriceRow('IN', 499));
    component.save();

    expect(billing.createCreditPack.calls.mostRecent().args[0].countryPrices).toEqual([{ countryCode: 'IN', amount: 499 }]);
  });

  it('locks the quota type when editing and sends the active flag', () => {
    const { component, billing } = create(pack);

    expect(component.form.controls.quotaType.disabled).toBeTrue();

    component.form.patchValue({ isActive: false });
    component.save();

    expect(billing.updateCreditPack).toHaveBeenCalledWith('cp1', {
      name: '1,000 AI conversations',
      units: 1000,
      priceCents: 1400,
      isActive: false,
      countryPrices: [],
    });
  });
});
