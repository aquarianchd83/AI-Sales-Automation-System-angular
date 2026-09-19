import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PlatformConfiguration } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { BillingService } from '../../../core/services/billing.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';
import { PlatformConfigurationService } from '../../../core/services/platform-configuration.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformConfigurationComponent } from './platform-configuration.component';

const AVERAGES = {
  assumptions: {
    marketingSharePercent: 70, utilitySharePercent: 20, authenticationSharePercent: 10,
    promptTokensPerConversation: 2100, completionTokensPerConversation: 350,
    inputTokensPerCandidate: 5200, outputTokensPerCandidate: 700, webSearchesPerCandidate: 0.4,
  },
  aiSource: 'Average of 40 AI conversations in the last 90 days.',
  leadSource: 'Built-in estimate - no discovery runs recorded yet.',
};

const config = (): PlatformConfiguration => ({
  costAssumptions: {
    marketingSharePercent: 60, utilitySharePercent: 30, authenticationSharePercent: 10,
    promptTokensPerConversation: 1500, completionTokensPerConversation: 300,
    inputTokensPerCandidate: 6000, outputTokensPerCandidate: 800, webSearchesPerCandidate: 0.5,
  },
  tax: {
    supplierStateCode: 'MH',
    countries: [
      { countryCode: 'IN', countryName: 'India', taxName: 'GST', ratePercent: 18, splitByState: true },
      { countryCode: 'GB', countryName: 'United Kingdom', taxName: 'Tax', ratePercent: 0, splitByState: false },
    ],
  },
  fx: { inrPerUsd: 83 },
  countries: [
    { countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹', isEnabled: true },
    { countryCode: 'GB', countryName: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£', isEnabled: true },
    { countryCode: 'AU', countryName: 'Australia', currencyCode: 'AUD', currencySymbol: 'A$', isEnabled: false },
  ],
  refunds: { creditWindowDays: 30, subscriptionWindowDays: 7, subscriptionMaxUsageFraction: 0.1, subscriptionPeriodDays: 30, requestExpiryDays: 14 },
  alerts: { whatsAppTemplateName: 'billing_alert', whatsAppTemplateLanguage: 'en' },
  trial: { whatsAppMessages: 50, aiConversations: 50, leadCandidates: 10 },
  charges: {
    whatsApp: {
      default: { marketing: 0.025, utility: 0.004, authentication: 0.0135 },
      countries: [
        { countryCode: 'IN', countryName: 'India', marketing: 0.0099, utility: 0.0014, authentication: 0.0014 },
        { countryCode: 'GB', countryName: 'United Kingdom', marketing: 0.0529, utility: 0.022, authentication: 0.031 },
      ],
    },
    leadDiscovery: {
      defaultModel: null,
      webSearchPerThousand: 10,
      default: { model: 'Default', inputPerMillion: 1, outputPerMillion: 5, cacheReadPerMillion: 0.1, cacheWritePerMillion: 1.25 },
      models: [{ model: 'claude-sonnet-5', inputPerMillion: 2, outputPerMillion: 10, cacheReadPerMillion: 0.2, cacheWritePerMillion: 2.5 }],
    },
    ai: { defaultModel: null, models: [{ model: 'OpenAI:gpt-5-mini', promptPer1K: 0.00025, completionPer1K: 0.002 }] },
  },
});

describe('PlatformConfigurationComponent', () => {
  function render(loaded = config()) {
    const get = jasmine.createSpy('get').and.returnValue(of(loaded));
    const save = jasmine.createSpy('save').and.callFake((c: PlatformConfiguration) => of(c));
    const success = jasmine.createSpy('success');
    const getPlanCostDefaults = jasmine.createSpy('getPlanCostDefaults').and.returnValue(of(AVERAGES));

    TestBed.configureTestingModule({
      declarations: [PlatformConfigurationComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformConfigurationService, useValue: { get, save } },
        { provide: NotificationService, useValue: { success } },
        { provide: PlatformBillingService, useValue: { getPlanCostDefaults } },
        { provide: BillingService, useValue: { getStates: () => of([{ code: 'MH', name: 'Maharashtra' }, { code: 'KA', name: 'Karnataka' }]) } },
      ],
    });

    const fixture = TestBed.createComponent(PlatformConfigurationComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement, save, success, getPlanCostDefaults };
  }

  const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');

  it('lists every section as a collapsible panel, all closed to start with', () => {
    const { root } = render();

    const titles = Array.from(root.querySelectorAll('mat-panel-title')).map((h) => text(h).trim());
    expect(titles).toEqual([
      'Countries',
      'Tax',
      'Exchange rate',
      'Typical usage (for costing plans)',
      'Refund policy',
      'Billing alerts',
      'Trial quota',
      'WhatsApp messages',
      'Lead discovery',
      'AI conversations',
    ]);
    expect(root.querySelectorAll('mat-expansion-panel.mat-expanded').length).toBe(0);
  });

  it('expands and collapses everything at once', () => {
    const { fixture, component, root } = render();

    component.setAll(true);
    fixture.detectChanges();
    expect(root.querySelectorAll('mat-expansion-panel.mat-expanded').length).toBe(10);

    component.setAll(false);
    fixture.detectChanges();
    expect(root.querySelectorAll('mat-expansion-panel.mat-expanded').length).toBe(0);
  });

  it('opens the section a bad value is in, and flags it while closed', () => {
    const { fixture, component, root } = render();
    expect(component.sectionInvalid('refunds')).toBeFalse();

    component.form.controls.refunds.controls['creditWindowDays'].setValue(0);
    fixture.detectChanges();
    expect(component.sectionInvalid('refunds')).toBeTrue();
    expect(component.sectionInvalid('trial')).toBeFalse();
    expect(root.querySelectorAll('.panel-warn').length).toBe(1);

    component.save();
    fixture.detectChanges();
    expect(component.open['refunds']).toBeTrue();
    expect(component.open['trial']).toBeFalse();
  });

  it('loads the stored values, showing the usage limit as a percentage', () => {
    const { component } = render();
    const v = component.form.getRawValue();

    expect(v.refunds.creditWindowDays).toBe(30);
    expect(v.refunds.subscriptionMaxUsagePercent).toBe(10);
    expect(v.alerts.whatsAppTemplateName).toBe('billing_alert');
    expect(component.countries.length).toBe(2);
    expect(component.leadModels.length).toBe(1);
    expect(component.aiModels.length).toBe(1);
  });

  it('has no separate quota-weights setting: the weights follow the message prices', () => {
    const { component, root, fixture } = render();

    expect(text(root)).not.toContain('WhatsApp quota weights');
    expect(component.form.contains('quotaWeights')).toBeFalse();
    // Default row 0.025 / 0.004 / 0.0135: utility is 16% of a marketing message, authentication 54%.
    expect(component.quotaUsePerMessage).toEqual({ marketing: 1, utility: 0.16, authentication: 0.54 });
    expect(text(root.querySelector('.quota-use')!)).toContain('utility 0.16');

    component.form.controls.whatsAppDefault.patchValue({ utility: 0.0125 });
    fixture.detectChanges();
    expect(component.quotaUsePerMessage.utility).toBe(0.5);
  });

  it('never sends quota weights', () => {
    const { component, save } = render();

    component.form.markAsDirty();
    component.save();

    expect(save.calls.mostRecent().args[0].quotaWeights).toBeUndefined();
  });

  it('shows a rate row per country with the three message categories', () => {
    const { root } = render();

    expect(text(root)).toContain('India');
    expect(text(root)).toContain('United Kingdom');
    expect(text(root)).toContain('Marketing');
    expect(text(root)).toContain('Utility');
    expect(text(root)).toContain('Authentication');
  });

  it('starts pristine with Save disabled, and enables it once something changes', () => {
    const { fixture, component, root } = render();
    const saveButton = () => root.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(saveButton().disabled).toBeTrue();

    component.form.controls.trial.controls['leadCandidates'].setValue(25);
    component.form.markAsDirty();
    fixture.detectChanges();

    expect(saveButton().disabled).toBeFalse();
  });

  it('sends the edited document, converting the percentage back to a fraction', () => {
    const { component, save, success } = render();

    component.form.controls.refunds.controls['subscriptionMaxUsagePercent'].setValue(25);
    component.form.controls.trial.controls['leadCandidates'].setValue(25);
    component.countries.at(0).controls['marketing'].setValue(0.0123);
    component.form.markAsDirty();
    component.save();

    const sent: PlatformConfiguration = save.calls.mostRecent().args[0];
    expect(sent.refunds.subscriptionMaxUsageFraction).toBe(0.25);
    expect(sent.trial.leadCandidates).toBe(25);
    expect(sent.charges.whatsApp.countries[0]).toEqual(jasmine.objectContaining({ countryCode: 'IN', marketing: 0.0123 }));
    expect(sent.charges.leadDiscovery.default.model).toBe('Default');
    expect(success).toHaveBeenCalled();
    expect(component.form.pristine).toBeTrue();
  });

  it('adds a new AI model row and sends it', () => {
    const { component, save } = render();

    component.addAiModel();
    component.aiModels.at(1).patchValue({ model: 'Google:gemini-x', promptPer1K: 0.002, completionPer1K: 0.008 });
    component.save();

    expect(save.calls.mostRecent().args[0].charges.ai.models[1]).toEqual({ model: 'Google:gemini-x', promptPer1K: 0.002, completionPer1K: 0.008 });
  });

  it('starts with no default model chosen', () => {
    const { component } = render();

    expect(component.isDefault('lead', component.leadModels.at(0))).toBeFalse();
    expect(component.isDefault('ai', component.aiModels.at(0))).toBeFalse();
  });

  it('marks the one model in use as the default for each, and sends it', () => {
    const { component, save } = render();

    component.toggleDefault('lead', component.leadModels.at(0));
    component.toggleDefault('ai', component.aiModels.at(0));
    expect(component.isDefault('lead', component.leadModels.at(0))).toBeTrue();
    expect(component.form.pristine).toBeFalse();

    component.save();

    const sent: PlatformConfiguration = save.calls.mostRecent().args[0];
    expect(sent.charges.leadDiscovery.defaultModel).toBe('claude-sonnet-5');
    expect(sent.charges.ai.defaultModel).toBe('OpenAI:gpt-5-mini');
  });

  it('clears the default when its toggle is clicked again, and shows a stored default as chosen', () => {
    const stored = config();
    stored.charges.ai.defaultModel = 'OpenAI:gpt-5-mini';
    const { component, save } = render(stored);

    expect(component.isDefault('ai', component.aiModels.at(0))).toBeTrue();

    component.toggleDefault('ai', component.aiModels.at(0));
    component.save();

    expect(save.calls.mostRecent().args[0].charges.ai.defaultModel).toBeNull();
  });

  it('drops the default when the new model row that held it is removed', () => {
    const { component, save } = render();

    component.addAiModel();
    component.aiModels.at(1).patchValue({ model: 'Google:gemini-x' });
    component.toggleDefault('ai', component.aiModels.at(1));
    component.removeNew(component.aiModels, 1);
    component.save();

    expect(save.calls.mostRecent().args[0].charges.ai.defaultModel).toBeNull();
  });

  it('lists every country with its on/off state', () => {
    const { root, component } = render();

    const boxes = Array.from(root.querySelectorAll('.country-choice mat-checkbox'));
    expect(boxes.length).toBe(3);
    expect(text(boxes[2])).toContain('Australia');
    expect(component.countryChoices.at(2).controls['isEnabled'].value).toBeFalse();
    expect(component.countryChoices.at(0).controls['isEnabled'].value).toBeTrue();
  });

  it('sends the countries switched on and off with the rest of the configuration', () => {
    const { component, save } = render();

    component.countryChoices.at(0).controls['isEnabled'].setValue(false);
    component.countryChoices.at(2).controls['isEnabled'].setValue(true);
    component.form.markAsDirty();
    component.save();

    const sent: PlatformConfiguration = save.calls.mostRecent().args[0];
    expect(sent.countries!.map((c) => [c.countryCode, c.isEnabled])).toEqual([
      ['IN', false],
      ['GB', true],
      ['AU', true],
    ]);
  });

  it('will not let every country be switched off', () => {
    const { fixture, component, save, root } = render();

    component.countryChoices.controls.forEach((c) => c.controls['isEnabled'].setValue(false));
    component.form.markAsDirty();
    fixture.detectChanges();
    component.save();

    expect(save).not.toHaveBeenCalled();
    expect(text(root)).toContain('At least one country must stay enabled');
  });

  it('shows the tax rules and the exchange rate as loaded', () => {
    const { component, root } = render();

    expect(component.form.controls.supplierStateCode.value).toBe('MH');
    expect(component.taxCountries.length).toBe(2);
    expect(component.taxCountries.at(0).controls['ratePercent'].value).toBe(18);
    expect(component.taxCountries.at(0).controls['splitByState'].value).toBeTrue();
    expect(component.form.controls.inrPerUsd.value).toBe(83);
    expect(text(root)).toContain('Rupees per US dollar');
  });

  it('sends the edited tax rules and exchange rate with the rest of the configuration', () => {
    const { component, save } = render();

    component.form.controls.supplierStateCode.setValue('KA');
    component.taxCountries.at(0).controls['ratePercent'].setValue(12);
    component.taxCountries.at(1).patchValue({ taxName: 'VAT', ratePercent: 20 });
    component.form.controls.inrPerUsd.setValue(91.5);
    component.form.markAsDirty();
    component.save();

    const sent: PlatformConfiguration = save.calls.mostRecent().args[0];
    expect(sent.tax!.supplierStateCode).toBe('KA');
    expect(sent.tax!.countries[0]).toEqual(jasmine.objectContaining({ countryCode: 'IN', ratePercent: 12, splitByState: true }));
    expect(sent.tax!.countries[1]).toEqual(jasmine.objectContaining({ taxName: 'VAT', ratePercent: 20 }));
    expect(sent.fx).toEqual({ inrPerUsd: 91.5 });
  });

  it('will not save an exchange rate of zero or a tax rate over 100', () => {
    const { component, save } = render();

    component.form.controls.inrPerUsd.setValue(0);
    component.save();
    expect(save).not.toHaveBeenCalled();

    component.form.controls.inrPerUsd.setValue(83);
    component.taxCountries.at(0).controls['ratePercent'].setValue(150);
    component.save();
    expect(save).not.toHaveBeenCalled();
  });

  it('holds the typical usage the plan report needs, so no plan page asks for it', () => {
    const { component, root } = render();

    expect(component.form.controls.costing.controls['promptTokensPerConversation'].value).toBe(1500);
    expect(component.form.controls.costing.controls['marketingSharePercent'].value).toBe(60);
    expect(text(root)).toContain('Typical usage (for costing plans)');
  });

  it('fills the typical usage from platform averages on request, without saving, and says where they came from', () => {
    const { component, root, fixture, save, getPlanCostDefaults } = render();

    component.fillFromAverages();
    fixture.detectChanges();

    expect(getPlanCostDefaults).toHaveBeenCalled();
    expect(component.form.controls.costing.controls['promptTokensPerConversation'].value).toBe(2100);
    expect(component.form.controls.costing.controls['marketingSharePercent'].value).toBe(70);
    expect(text(root)).toContain('Average of 40 AI conversations');
    expect(component.form.dirty).toBeTrue();
    expect(save).not.toHaveBeenCalled();
  });

  it('sends the typical usage with the rest of the configuration', () => {
    const { component, save } = render();

    component.form.controls.costing.patchValue({ promptTokensPerConversation: 3000, utilitySharePercent: 25 });
    component.form.markAsDirty();
    component.save();

    expect(save.calls.mostRecent().args[0].costAssumptions).toEqual(
      jasmine.objectContaining({ promptTokensPerConversation: 3000, utilitySharePercent: 25, completionTokensPerConversation: 300 })
    );
  });

  it('will not save with a bad value', () => {
    const { component, save } = render();

    component.form.controls.alerts.controls['whatsAppTemplateName'].setValue('Has Spaces');
    component.form.controls.refunds.controls['creditWindowDays'].setValue(0);
    component.save();

    expect(save).not.toHaveBeenCalled();
  });

  it('will not save an AI model whose name has no provider', () => {
    const { component, save } = render();

    component.addAiModel();
    component.aiModels.at(1).patchValue({ model: 'no-provider' });
    component.save();

    expect(save).not.toHaveBeenCalled();
  });
});
