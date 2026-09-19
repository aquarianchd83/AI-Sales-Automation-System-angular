import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { QuotaType } from '../../../core/models/billing.model';
import { PlanCostDefaults, PlanCostReport, PlatformPlan } from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { SharedModule } from '../../../shared/shared.module';
import { CountryPriceEditorComponent, newCountryPriceRow } from '../country-price-editor/country-price-editor.component';
import { PlatformPlanEditorComponent } from './platform-plan-editor.component';

const defaults: PlanCostDefaults = {
  assumptions: {
    marketingSharePercent: 60,
    utilitySharePercent: 30,
    authenticationSharePercent: 10,
    promptTokensPerConversation: 1500,
    completionTokensPerConversation: 300,
    inputTokensPerCandidate: 6000,
    outputTokensPerCandidate: 800,
    webSearchesPerCandidate: 0.5,
  },
  aiSource: 'Average of 40 AI conversations in the last 90 days.',
  leadSource: 'Built-in estimate - no discovery runs recorded yet.',
};

const report = (over: Partial<PlanCostReport> = {}): PlanCostReport => ({
  whatsAppUnits: 5000,
  whatsAppMessagesEstimate: 6897,
  whatsAppCategories: [
    { category: 'Marketing', sharePercent: 60, quotaWeight: 1, messages: 4138 },
    { category: 'Utility', sharePercent: 30, quotaWeight: 0.25, messages: 2069 },
    { category: 'Authentication', sharePercent: 10, quotaWeight: 0.5, messages: 690 },
  ],
  ai: { units: 500, model: 'OpenAI:gpt-5-mini', costPerConversationUsd: 0.000975, totalUsd: 0.4875 },
  leads: { units: 200, model: 'claude-sonnet-5', costPerCandidateUsd: 0.0245, totalUsd: 4.9 },
  countries: [
    { countryCode: 'US', countryName: 'United States', currencyCode: 'USD', currencySymbol: '$', priceLocal: 59, isCustomPrice: false, whatsAppCostUsd: 30, aiCostUsd: 0.49, leadCostUsd: 4.9, totalCostUsd: 35.39, costLocal: 35.39, marginLocal: 23.61, marginPercent: 40, isSold: true, priceInr: 4897, costInr: 2937.37, marginInr: 1959.63 },
    { countryCode: 'DE', countryName: 'Germany', currencyCode: 'EUR', currencySymbol: '€', priceLocal: 54, isCustomPrice: true, whatsAppCostUsd: 400, aiCostUsd: 0.49, leadCostUsd: 4.9, totalCostUsd: 405.39, costLocal: 372.96, marginLocal: -318.96, marginPercent: -590, isSold: true, priceInr: 4870, costInr: 33646.37, marginInr: -28776.37 },
    { countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£', priceLocal: 0, isCustomPrice: false, whatsAppCostUsd: 20, aiCostUsd: 0.49, leadCostUsd: 4.9, totalCostUsd: 25.39, costLocal: 20.06, marginLocal: 0, marginPercent: null, isSold: false, priceInr: 0, costInr: 2107.37, marginInr: 0 },
  ],
  warnings: ['At this price the plan loses money in: Germany.'],
  assumptions: defaults.assumptions,
  inrPerUsd: 83,
  ...over,
});

const plan: PlatformPlan = {
  id: 'pl1', code: 'growth', name: 'Growth', maxUsers: 5, maxMessagesPerMonth: 5000, maxCampaigns: 10, maxKnowledgeBaseArticles: 50,
  maxLeadDiscoveryBatchSize: 25, priceMonthlyCents: 9900, isActive: true, currencyCode: 'USD', currencySymbol: '$', priceMonthlyLocal: 99,
  includedQuotas: [{ quotaType: QuotaType.WhatsAppMessages, units: 5000 }, { quotaType: QuotaType.LeadCandidates, units: 300 }],
  countryPrices: [{ countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹', amount: 999 }],
};

const REGIONS = [
  { countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹' },
  { countryCode: 'US', countryName: 'United States', currencyCode: 'USD', currencySymbol: '$' },
];

describe('PlatformPlanEditorComponent', () => {
  function create(planId: string | null = null, buildReport = () => of(report())) {
    const billing = {
      getPlans: jasmine.createSpy('getPlans').and.returnValue(of([plan])),
      buildPlanCostReport: jasmine.createSpy('buildPlanCostReport').and.callFake(buildReport),
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

  const settle = (fixture: { detectChanges: () => void }) => {
    tick(400); // past the report's debounce
    fixture.detectChanges();
  };
  const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');

  it('is a page with a create heading, not a dialog, with no usage-assumptions section', fakeAsync(() => {
    const { fixture, root } = create();
    settle(fixture);

    expect(text(root.querySelector('h1')!)).toContain('Create plan');
    expect(text(root)).not.toContain('How tenants will use it');
    expect(root.querySelector('[formControlName="promptTokensPerConversation"]')).toBeNull();
    expect(root.querySelector('[formControlName="marketingSharePercent"]')).toBeNull();
  }));

  it('builds the report from the quotas, price and country prices as they are typed', fakeAsync(() => {
    const { fixture, component, billing } = create();
    settle(fixture);
    billing.buildPlanCostReport.calls.reset();

    component.form.patchValue({ quotaWhatsApp: 5000, quotaAi: 500, quotaLeads: 200 });
    component.countryPrices.at(0).patchValue({ amount: 999 }); // India's row, there from the start
    component.countryPrices.push(newCountryPriceRow('', 0)); // still being filled in - left out
    settle(fixture);

    expect(billing.buildPlanCostReport).toHaveBeenCalledTimes(1);
    const request = billing.buildPlanCostReport.calls.mostRecent().args[0];
    expect(request.includedQuotas).toEqual([
      { quotaType: QuotaType.WhatsAppMessages, units: 5000 },
      { quotaType: QuotaType.AiConversations, units: 500 },
      { quotaType: QuotaType.LeadCandidates, units: 200 },
    ]);
    expect(request.priceMonthlyCents).toBeUndefined();
    expect(request.countryPrices).toEqual([{ countryCode: 'IN', amount: 999 }]);
  }));

  it('shows the consolidated report: unit costs, cost and margin per country, and the warning', fakeAsync(() => {
    const { fixture, root } = create();
    settle(fixture);

    const report$ = root.querySelector('.report')!;
    expect(text(report$)).toContain('Consolidated report');
    expect(text(report$)).toContain('OpenAI:gpt-5-mini');
    expect(text(report$)).toContain('claude-sonnet-5');
    expect(text(report$)).toContain('United States');
    expect(text(report$)).toContain('Germany');
    // A country with no price is marked as not sold, and has no margin.
    expect(text(report$)).toContain('Not sold');
    expect(root.querySelectorAll('.unsold-row').length).toBe(1);
    expect(text(report$)).toContain('loses money in: Germany');
    expect(text(report$)).toContain('4,138 marketing');
    // The loss-making country is marked.
    expect(root.querySelectorAll('.loss-row').length).toBe(1);
    expect(text(root.querySelector('.headline')!)).toContain('-590%');
  }));

  it('reads its costs from the Configuration page: links to it, shows the typical usage it uses, and sends none itself', fakeAsync(() => {
    const { fixture, component, root, billing } = create();
    settle(fixture);

    const link = root.querySelector('.report a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/platform/configuration');
    expect(text(root.querySelector('.assumptions-note')!)).toContain('60% marketing');
    expect(text(root.querySelector('.assumptions-note')!)).toContain('1,500 + 300 tokens');

    component.form.patchValue({ quotaAi: 10 });
    settle(fixture);
    expect(billing.buildPlanCostReport.calls.mostRecent().args[0].assumptions).toBeUndefined();
  }));

  it('says so when the report cannot be calculated, and keeps the last good one', fakeAsync(() => {
    let fail = false;
    const { fixture, component, root } = create(null, () => (fail ? throwError(() => new Error('x')) : of(report())));
    settle(fixture);

    fail = true;
    component.form.patchValue({ quotaAi: 10 });
    settle(fixture);

    expect(text(root)).toContain('The report could not be calculated');
    expect(text(root)).toContain('United States');
  }));

  it('creates the plan with its quotas and country prices, then returns to the Package screen', fakeAsync(() => {
    const { fixture, component, billing, router, success } = create();
    settle(fixture);

    component.form.patchValue({ code: 'pro', name: 'Pro', quotaWhatsApp: 20000, quotaAi: 1500 });
    component.countryPrices.at(0).patchValue({ amount: 4999 });
    component.save();

    const sent = billing.createPlan.calls.mostRecent().args[0];
    expect(sent.code).toBe('pro');
    expect(sent.priceMonthlyCents).toBe(0); // the price is the country prices; the server derives the legacy figure
    expect(sent.includedQuotas![0]).toEqual({ quotaType: QuotaType.WhatsAppMessages, units: 20000 });
    expect(sent.countryPrices).toEqual([{ countryCode: 'IN', amount: 4999 }]);
    expect(success).toHaveBeenCalledWith('Plan created.');
    expect(router.navigate).toHaveBeenCalledWith(['/platform/billing']);
    tick(400); // let the report's pending recalculation finish
  }));

  it('starts a new plan with the India row, to be priced in rupees, and will not create it until it is priced', fakeAsync(() => {
    const { fixture, component, billing } = create();
    settle(fixture);

    expect(component.countryPrices.length).toBe(1);
    expect(component.countryPrices.at(0).controls.countryCode.value).toBe('IN');

    component.form.patchValue({ code: 'pro', name: 'Pro' });
    component.save(); // India's price is still 0
    expect(billing.createPlan).not.toHaveBeenCalled();

    component.countryPrices.at(0).patchValue({ amount: 999 });
    component.save();
    expect(billing.createPlan).toHaveBeenCalled();
    tick(400);
  }));

  it('has no dollar price field: the price is only ever the country prices', fakeAsync(() => {
    const { fixture, root } = create();
    settle(fixture);

    expect(root.querySelector('[formControlName="priceMonthlyDollars"]')).toBeNull();
    expect(text(root)).not.toContain('USD / month');
  }));

  it('has no monthly message cap field, and puts the per-run lead cap beside the lead quota', fakeAsync(() => {
    const { fixture, root } = create();
    settle(fixture);

    expect(root.querySelector('[formControlName="maxMessagesPerMonth"]')).toBeNull();
    expect(text(root)).not.toContain('Max messages / month');

    const quotaCard = Array.from(root.querySelectorAll('mat-card')).find((c) => text(c).includes('Included quota per billing period'))!;
    expect(text(quotaCard)).toContain('Lead candidates');
    expect(text(quotaCard)).toContain('Leads per discovery run (cap on one run)');
    const limitsCard = Array.from(root.querySelectorAll('mat-card')).find((c) => c.querySelector('h2')?.textContent === 'Limits')!;
    expect(text(limitsCard)).not.toContain('discovery run');
  }));

  it('stores no message figure for a new plan', fakeAsync(() => {
    const created = create();
    settle(created.fixture);
    created.component.form.patchValue({ code: 'pro', name: 'Pro' });
    created.component.countryPrices.at(0).patchValue({ amount: 999 });
    created.component.save();
    expect(created.billing.createPlan.calls.mostRecent().args[0].maxMessagesPerMonth).toBe(0);
    tick(400);
  }));

  it('will not create a plan with no code or name', fakeAsync(() => {
    const { fixture, component, billing } = create();
    settle(fixture);

    component.save();

    expect(billing.createPlan).not.toHaveBeenCalled();
  }));

  it('opens an existing plan for editing with its quotas, prices and a locked code', fakeAsync(() => {
    const { fixture, component, root } = create('pl1');
    settle(fixture);

    expect(text(root.querySelector('h1')!)).toContain('Edit plan');
    expect(component.form.controls.code.disabled).toBeTrue();
    expect(component.form.controls.quotaWhatsApp.value).toBe(5000);
    expect(component.form.controls.quotaLeads.value).toBe(300);
    expect(component.form.controls.quotaAi.value).toBe(0);
    expect(component.countryPrices.length).toBe(1);
  }));

  it('saves an edit as the complete set of quotas and country prices', fakeAsync(() => {
    const { fixture, component, billing, success } = create('pl1');
    settle(fixture);

    component.form.patchValue({ quotaLeads: 0, quotaAi: 200 });
    component.countryPrices.removeAt(0);
    component.save();

    const [id, sent] = billing.updatePlan.calls.mostRecent().args;
    expect(id).toBe('pl1');
    expect(sent.includedQuotas).toEqual([
      { quotaType: QuotaType.WhatsAppMessages, units: 5000 },
      { quotaType: QuotaType.AiConversations, units: 200 },
      { quotaType: QuotaType.LeadCandidates, units: 0 },
    ]);
    expect(sent.countryPrices).toEqual([]);
    expect(success).toHaveBeenCalledWith('Plan updated.');
    tick(400);
  }));

  it('shows a plan that no longer exists as a load failure rather than an empty form', fakeAsync(() => {
    const { fixture, root } = create('missing');
    settle(fixture);

    expect(text(root)).toContain('That plan could not be loaded');
  }));
});
