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

  it('starts a new pack with the India row, since the platform is based there, and sends the price in rupees', () => {
    const { component, billing, dialogRef } = create(null);
    expect(component.countryPrices.length).toBe(1);
    expect(component.countryPrices.at(0).controls.countryCode.value).toBe('IN');

    component.form.patchValue({ quotaType: QuotaType.LeadCandidates, name: ' 500 leads ', units: 500 });
    component.countryPrices.at(0).patchValue({ amount: 830 });
    component.save();

    // The price is the country prices; the server derives the one legacy USD figure.
    expect(billing.createCreditPack).toHaveBeenCalledWith({
      quotaType: QuotaType.LeadCandidates,
      name: '500 leads',
      units: 500,
      priceCents: 0,
      countryPrices: [{ countryCode: 'IN', amount: 830 }],
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('will not save a pack with a blank name or an unpriced country row', () => {
    const { component, billing } = create(null);

    component.form.patchValue({ name: '' });
    component.save();
    expect(billing.createCreditPack).not.toHaveBeenCalled();

    component.form.patchValue({ name: 'Leads' });
    component.save(); // India's row is still at 0
    expect(billing.createCreditPack).not.toHaveBeenCalled();
  });

  it('sends several country prices along with the pack', () => {
    const { component, billing } = create(null);

    component.form.patchValue({ name: 'Leads', units: 500 });
    component.countryPrices.at(0).patchValue({ amount: 499 });
    component.countryPrices.push(newCountryPriceRow('GB', 5));
    component.save();

    expect(billing.createCreditPack.calls.mostRecent().args[0].countryPrices).toEqual([
      { countryCode: 'IN', amount: 499 },
      { countryCode: 'GB', amount: 5 },
    ]);
  });

  it('locks the quota type when editing and sends the active flag', () => {
    const { component, billing } = create(pack);

    expect(component.form.controls.quotaType.disabled).toBeTrue();

    component.form.patchValue({ isActive: false });
    component.save();

    expect(billing.updateCreditPack).toHaveBeenCalledWith('cp1', {
      name: '1,000 AI conversations',
      units: 1000,
      priceCents: 0,
      isActive: false,
      countryPrices: [],
    });
  });
});
