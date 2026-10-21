import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
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
  quotaType: QuotaType.Credits,
  name: '500 credits',
  units: 500,
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
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
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
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement, billing, dialogRef };
  }

  it('has no choice of what the credits are for: there is one wallet', () => {
    const { root } = create(null);

    expect(root.textContent).not.toContain('Credits for');
    expect(root.querySelector('[formControlName="quotaType"]')).toBeNull();
  });

  it('creates a pack of credits with its country prices', () => {
    const { component, billing, dialogRef } = create(null);
    component.form.patchValue({ name: '500 credits', units: 500 });
    component.countryPrices.clear();
    component.countryPrices.push(newCountryPriceRow('IN', 499));

    component.save();

    expect(billing.createCreditPack).toHaveBeenCalledWith({
      quotaType: QuotaType.Credits,
      name: '500 credits',
      units: 500,
      priceCents: 0,
      countryPrices: [{ countryCode: 'IN', amount: 499 }],
    });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('edits an existing pack without touching what it is for', () => {
    const { component, billing } = create(pack);
    component.form.patchValue({ units: 1000 });

    component.save();

    expect(billing.updateCreditPack).toHaveBeenCalledWith('cp1', jasmine.objectContaining({ name: '500 credits', units: 1000, isActive: true }));
    expect(billing.createCreditPack).not.toHaveBeenCalled();
  });

  it('will not save a pack with no credits in it', () => {
    const { component, billing } = create(null);
    component.form.patchValue({ name: 'Empty', units: 0 });

    component.save();

    expect(billing.createCreditPack).not.toHaveBeenCalled();
  });
});
