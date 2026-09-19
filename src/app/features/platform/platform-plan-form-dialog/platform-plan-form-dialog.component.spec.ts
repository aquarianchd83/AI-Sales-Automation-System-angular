import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { QuotaType } from '../../../core/models/billing.model';
import { PlatformPlan } from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { CountryPriceEditorComponent, newCountryPriceRow } from '../country-price-editor/country-price-editor.component';
import { PlatformPlanFormDialogComponent } from './platform-plan-form-dialog.component';

const plan: PlatformPlan = {
  id: 'pl1',
  code: 'growth',
  name: 'Growth',
  maxUsers: 5,
  maxMessagesPerMonth: 5000,
  maxCampaigns: 10,
  maxKnowledgeBaseArticles: 50,
  maxLeadDiscoveryBatchSize: 25,
  priceMonthlyCents: 9900,
  isActive: true,
  currencyCode: 'USD',
  currencySymbol: '$',
  priceMonthlyLocal: 99,
  countryPrices: [{ countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹', amount: 999 }],
  includedQuotas: [
    { quotaType: QuotaType.WhatsAppMessages, units: 5000 },
    { quotaType: QuotaType.LeadCandidates, units: 300 },
  ],
};

const REGIONS = [
  { countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹' },
  { countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£' },
];

describe('PlatformPlanFormDialogComponent quotas', () => {
  function create(existing: PlatformPlan | null) {
    const billing = {
      createPlan: jasmine.createSpy('createPlan').and.returnValue(of(plan)),
      updatePlan: jasmine.createSpy('updatePlan').and.returnValue(of(plan)),
    };

    TestBed.configureTestingModule({
      declarations: [PlatformPlanFormDialogComponent, CountryPriceEditorComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformBillingService, useValue: billing },
        { provide: BillingService, useValue: { getRegions: () => of(REGIONS) } },
        { provide: NotificationService, useValue: { success: () => {} } },
        { provide: MatDialogRef, useValue: { close: () => {} } },
        { provide: MAT_DIALOG_DATA, useValue: { plan: existing } },
      ],
    });

    const fixture = TestBed.createComponent(PlatformPlanFormDialogComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, billing };
  }

  it('starts from the plan\'s current quotas, with 0 for a type it does not include', () => {
    const { component } = create(plan);

    expect(component.form.controls.quotaWhatsApp.value).toBe(5000);
    expect(component.form.controls.quotaAi.value).toBe(0);
    expect(component.form.controls.quotaLeads.value).toBe(300);
  });

  it('sends the full quota set on update, 0 meaning remove', () => {
    const { component, billing } = create(plan);

    component.form.patchValue({ quotaAi: 200, quotaLeads: 0 });
    component.save();

    const request = billing.updatePlan.calls.mostRecent().args[1];
    expect(request.includedQuotas).toEqual([
      { quotaType: QuotaType.WhatsAppMessages, units: 5000 },
      { quotaType: QuotaType.AiConversations, units: 200 },
      { quotaType: QuotaType.LeadCandidates, units: 0 },
    ]);
  });

  it('sends the quotas when creating a plan', () => {
    const { component, billing } = create(null);

    component.form.patchValue({ code: 'pro', name: 'Pro', priceMonthlyDollars: 199, quotaWhatsApp: 20000 });
    component.save();

    expect(billing.createPlan.calls.mostRecent().args[0].includedQuotas![0]).toEqual({
      quotaType: QuotaType.WhatsAppMessages,
      units: 20000,
    });
  });

  it('sends the country prices as the complete set, and a removed row is simply absent', () => {
    const { component, billing } = create(plan);

    // Starts with India from the plan; add Britain, then drop India.
    component.countryPrices.push(newCountryPriceRow('GB', 40));
    component.countryPrices.removeAt(0);
    component.save();

    expect(billing.updatePlan.calls.mostRecent().args[1].countryPrices).toEqual([{ countryCode: 'GB', amount: 40 }]);
  });

  it('will not save a country price row with no country or no amount', () => {
    const { component, billing } = create(plan);

    component.countryPrices.push(newCountryPriceRow('', 0));
    component.save();

    expect(billing.updatePlan).not.toHaveBeenCalled();
  });

  it('rejects a negative quota', () => {
    const { component, billing } = create(plan);

    component.form.patchValue({ quotaAi: -1 });
    component.save();

    expect(billing.updatePlan).not.toHaveBeenCalled();
  });
});
