import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { QuotaType } from '../../../core/models/billing.model';
import { CreditPackCostReport, PlatformCreditPack } from '../../../core/models/platform.model';
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


const costReport = (over: Partial<CreditPackCostReport> = {}): CreditPackCostReport => ({
  quotaType: QuotaType.AiConversations, units: 1000, marginPercent: 50, unitCostInr: 0.10375, totalCostInr: 103.75,
  countries: [
    { countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹', costLocal: 103.75, suggestedPriceLocal: 155.63, costInr: 103.75, suggestedPriceInr: 155.63 },
    { countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£', costLocal: 0.99, suggestedPriceLocal: 1.49, costInr: 103.75, suggestedPriceInr: 156.5 },
  ],
  warnings: [],
  assumptions: {} as CreditPackCostReport['assumptions'],
  ...over,
});

describe('PlatformCreditPackFormDialogComponent', () => {
  function create(existing: PlatformCreditPack | null) {
    const billing = {
      buildCreditPackCost: jasmine.createSpy('buildCreditPackCost').and.callFake(() => of(costReport())),
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

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('works out what the pack costs to serve from the configuration, as soon as it opens', () => {
    const { billing, root } = create(null);

    expect(billing.buildCreditPackCost).toHaveBeenCalledWith({ quotaType: QuotaType.WhatsAppMessages, units: 1000, marginPercent: 50 });
    const panel = text(root.querySelector('.cost-panel'));
    expect(panel).toContain('₹103.75');
    expect(panel).toContain('to serve');
    expect(panel).toContain('₹155.63');
    expect(panel).toContain('£1.49');
    expect(root.querySelector('.cost-panel a')?.getAttribute('href')).toBe('/platform/configuration');
  });

  it('recalculates when the size, type or margin change', fakeAsync(() => {
    const { component, billing } = create(null);
    billing.buildCreditPackCost.calls.reset();

    component.form.patchValue({ quotaType: QuotaType.LeadCandidates, units: 200, marginPercent: 80 });
    tick(400);

    expect(billing.buildCreditPackCost).toHaveBeenCalledTimes(1);
    expect(billing.buildCreditPackCost).toHaveBeenCalledWith({ quotaType: QuotaType.LeadCandidates, units: 200, marginPercent: 80 });
  }));

  it('asks for nothing until there is a size to price', fakeAsync(() => {
    const { component, billing } = create(null);
    billing.buildCreditPackCost.calls.reset();

    component.form.patchValue({ units: 0 });
    tick(400);

    expect(billing.buildCreditPackCost).not.toHaveBeenCalled();
  }));

  it('fills every country price with the suggestions in one go', () => {
    const { component } = create(null);

    component.useSuggestedPrices();

    expect(component.countryPrices.getRawValue()).toEqual([
      { countryCode: 'IN', amount: 155.63 },
      { countryCode: 'GB', amount: 1.49 },
    ]);
  });

  it('fills one country from its suggestion, updating its row or adding one', () => {
    const { component } = create(null);
    const [india, britain] = costReport().countries;

    component.useSuggestedPrice(india);   // India's row is already there, at 0
    component.useSuggestedPrice(britain); // no British row yet

    expect(component.countryPrices.getRawValue()).toEqual([
      { countryCode: 'IN', amount: 155.63 },
      { countryCode: 'GB', amount: 1.49 },
    ]);
  });

  it('saves the prices it filled in, and never sends the margin, which is only a working figure', () => {
    const { component, billing } = create(null);

    component.form.patchValue({ name: 'AI pack', units: 1000, quotaType: QuotaType.AiConversations, marginPercent: 75 });
    component.useSuggestedPrices();
    component.save();

    const sent = billing.createCreditPack.calls.mostRecent().args[0];
    expect(sent.countryPrices).toEqual([
      { countryCode: 'IN', amount: 155.63 },
      { countryCode: 'GB', amount: 1.49 },
    ]);
    expect((sent as unknown as Record<string, unknown>)['marginPercent']).toBeUndefined();
  });

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
