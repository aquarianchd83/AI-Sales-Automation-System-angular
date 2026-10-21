import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformPlan } from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { CountryPriceEditorComponent } from '../country-price-editor/country-price-editor.component';
import { PlatformPlanEditorComponent } from './platform-plan-editor.component';

const plan: PlatformPlan = {
  id: 'pl1', code: 'premium', name: 'Premium', maxUsers: 5, maxMessagesPerMonth: 5000, maxCampaigns: 10, maxKnowledgeBaseArticles: 50,
  maxLeadDiscoveryBatchSize: 25, priceMonthlyCents: 9900, isActive: true, currencyCode: 'USD', currencySymbol: '$', priceMonthlyLocal: 99,
  starterCredits: 0,
  monthlyCredits: 100,
  features: ['WhatsAppMessaging', 'AiConversations', 'LeadDiscovery'],
  countryPrices: [{ countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹', amount: 999 }],
};

const REGIONS = [
  { countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹' },
  { countryCode: 'US', countryName: 'United States', currencyCode: 'USD', currencySymbol: '$' },
];

describe('PlatformPlanEditorComponent', () => {
  function create(planId: string | null = null) {
    const billing = {
      getPlans: jasmine.createSpy('getPlans').and.returnValue(of([plan])),
      createPlan: jasmine.createSpy('createPlan').and.returnValue(of(plan)),
      updatePlan: jasmine.createSpy('updatePlan').and.returnValue(of(plan)),
    };
    const success = jasmine.createSpy('success');

    TestBed.configureTestingModule({
      declarations: [PlatformPlanEditorComponent, CountryPriceEditorComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformBillingService, useValue: billing },
        { provide: BillingService, useValue: { getRegions: () => of(REGIONS) } },
        { provide: NotificationService, useValue: { success } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(planId ? { id: planId } : {}) } } },
      ],
    });

    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));

    const fixture = TestBed.createComponent(PlatformPlanEditorComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement, billing, router, success };
  }

  const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');

  it('is a page with a create heading and asks for credits and features, not per-quota units or a cost report', () => {
    const { root } = create();

    expect(text(root.querySelector('h1')!)).toContain('Create plan');
    expect(text(root)).toContain('Starter credits (once)');
    expect(text(root)).toContain('Credits every month');
    expect(root.querySelectorAll('.feature-list mat-checkbox').length).toBe(5);
    expect(text(root)).not.toContain('Included quota per billing period');
    expect(root.querySelector('.report')).toBeNull();
  });

  it('creates the plan with its credits, features and country prices, then returns to the Package screen', () => {
    const { component, billing, router, success } = create();

    component.form.patchValue({ code: 'trial', name: 'Trial', starterCredits: 50, monthlyCredits: 0 });
    component.toggleFeature('WhatsAppMessaging', true);
    component.toggleFeature('AiConversations', true);
    component.countryPrices.at(0).patchValue({ amount: 0 });
    component.countryPrices.at(0).patchValue({ amount: 1 });
    component.save();

    const sent = billing.createPlan.calls.mostRecent().args[0];
    expect(sent.code).toBe('trial');
    expect(sent.starterCredits).toBe(50);
    expect(sent.monthlyCredits).toBe(0);
    expect(sent.features).toEqual(['WhatsAppMessaging', 'AiConversations']);
    expect(sent.priceMonthlyCents).toBe(0); // the price is the country prices; the server derives the legacy figure
    expect(sent.maxMessagesPerMonth).toBe(0); // sending is paid for with credits, there is no message cap
    expect(success).toHaveBeenCalledWith('Plan created.');
    expect(router.navigate).toHaveBeenCalledWith(['/platform/billing']);
  });

  it('starts a new plan with the India row, to be priced in rupees, and will not create it until it is priced', () => {
    const { component, billing } = create();

    expect(component.countryPrices.length).toBe(1);
    expect(component.countryPrices.at(0).controls.countryCode.value).toBe('IN');

    component.form.patchValue({ code: 'pro', name: 'Pro' });
    component.save(); // India's price is still 0
    expect(billing.createPlan).not.toHaveBeenCalled();

    component.countryPrices.at(0).patchValue({ amount: 999 });
    component.save();
    expect(billing.createPlan).toHaveBeenCalled();
  });

  it('has no dollar price field: the price is only ever the country prices', () => {
    const { root } = create();

    expect(root.querySelector('[formControlName="priceMonthlyDollars"]')).toBeNull();
    expect(text(root)).not.toContain('USD / month');
  });

  it('will not create a plan with no code or name', () => {
    const { component, billing } = create();

    component.save();

    expect(billing.createPlan).not.toHaveBeenCalled();
  });

  it('opens an existing plan for editing with its credits, features, prices and a locked code', () => {
    const { component, root } = create('pl1');

    expect(text(root.querySelector('h1')!)).toContain('Edit plan');
    expect(component.form.controls.code.disabled).toBeTrue();
    expect(component.form.controls.monthlyCredits.value).toBe(100);
    expect(component.form.controls.starterCredits.value).toBe(0);
    expect(component.hasFeature('LeadDiscovery')).toBeTrue();
    expect(component.hasFeature('ContentStudio')).toBeFalse();
    expect(component.countryPrices.length).toBe(1);
  });

  it('saves an edit as the complete set of features and the credits', () => {
    const { component, billing, success } = create('pl1');

    component.toggleFeature('LeadDiscovery', false);
    component.toggleFeature('ContentStudio', true);
    component.form.patchValue({ monthlyCredits: 250 });
    component.save();

    const [id, sent] = billing.updatePlan.calls.mostRecent().args;
    expect(id).toBe('pl1');
    expect(sent.features).toEqual(['WhatsAppMessaging', 'AiConversations', 'ContentStudio']);
    expect(sent.monthlyCredits).toBe(250);
    expect(success).toHaveBeenCalledWith('Plan updated.');
  });

  it('shows a plan that no longer exists as a load failure rather than an empty form', () => {
    const { root } = create('missing');

    expect(text(root)).toContain('That plan could not be loaded');
  });
});
