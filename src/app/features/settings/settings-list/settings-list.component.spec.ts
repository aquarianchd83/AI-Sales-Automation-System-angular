import { TestBed } from '@angular/core/testing';
import { SettingItem } from '../../../core/models/settings.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { AiProviderInsight, AiProvidersOverview } from '../../../core/models/platform.model';
import { PlatformAiProvidersService } from '../../../core/services/platform-ai-providers.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { SettingsListComponent } from './settings-list.component';

const insight = (provider: 'OpenAI' | 'Anthropic' | 'Google', extra: Partial<AiProviderInsight> = {}): AiProviderInsight => ({
  provider,
  displayName: provider === 'OpenAI' ? 'ChatGPT' : provider === 'Anthropic' ? 'Claude' : 'Gemini',
  enabled: true,
  hasKey: true,
  model: 'm',
  status: 'NotVerified',
  lastCheckedAtUtc: null,
  lastCheckMessage: null,
  capabilities: [
    { task: 'ConversationReply', area: 'Customer chat', title: 'Replying to customers in WhatsApp', declared: true, verified: true, verifiedAtUtc: '2026-10-19T09:00:00Z' },
    { task: 'KnowledgeEmbedding', area: 'Customer chat', title: 'Knowledge base search (embeddings)', declared: false, verified: false, verifiedAtUtc: null },
    { task: 'DocumentAnalysis', area: 'Product knowledge', title: 'Document and PDF analysis', declared: true, verified: false, verifiedAtUtc: null },
  ],
  inputPer1MUsd: 0,
  outputPer1MUsd: 0,
  priceSet: false,
  benchmark: null,
  usedFor: [],
  ...extra,
});

const overview = (providers: AiProviderInsight[]): AiProvidersOverview => ({
  providers,
  policy: { fallbackEnabled: false, fallbackOrder: [], simulatorScenario: 'Success', maxCostPerCallUsd: 0.5, timeoutSeconds: 60, maxRetriesPerProvider: 1, scenarios: ['Success'] },
});

/** The insights service: returns no providers unless a test says otherwise. */
const insightsStub = (providers: AiProviderInsight[] = []) => {
  const spy = jasmine.createSpyObj<PlatformAiProvidersService>('PlatformAiProvidersService', ['get', 'benchmark']);
  spy.get.and.returnValue(of(overview(providers)));
  return spy;
};

const category = (name: string) => ({ category: name, items: [{ key: `${name}:Key`, value: 'v', isSecret: false, isList: false, description: null }] });

describe('SettingsListComponent', () => {
  const panelsFor = (routeData: Record<string, unknown>) => {
    const names = ['WhatsApp', 'AiProviders', 'Campaigns', 'MediaStorage', 'App', 'Email', 'Sms', 'PlatformWhatsApp', 'Razorpay', 'Retention'];
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: SettingsService, useValue: { getAll: () => of(names.map(category)) } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: routeData } } },
        { provide: PlatformAiProvidersService, useValue: insightsStub() },
      ],
    });

    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();

    return fixture.componentInstance.panels.map((p) => p.category.category);
  };

  it('leaves out the categories that have a settings screen of their own', () => {
    expect(panelsFor({})).toEqual(['AiProviders', 'Campaigns', 'Retention']);
  });

  it('renders one card per provider on the AI Providers screen, with no General card', () => {
    const item = (key: string) => ({ key, value: 'v', isSecret: false, isList: false, description: null });
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        {
          provide: SettingsService,
          useValue: {
            getAll: () => of([{ category: 'AiProviders', items: ['AiProviders:Provider', 'AiProviders:OpenAI:ApiKey', 'AiProviders:Google:ApiKey'].map(item) }]),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { categories: ['AiProviders'] } } } },
        { provide: PlatformAiProvidersService, useValue: insightsStub() },
      ],
    });

    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(Array.from(root.querySelectorAll('.group-title')).map((e) => e.textContent?.trim())).toEqual(['OpenAI', 'Google']);
    expect(root.querySelectorAll('input').length).toBe(2);
  });

  it('offers a toggle for an On/Off setting, a dropdown for other fixed choices and a text box for one without', () => {
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        {
          provide: SettingsService,
          useValue: {
            getAll: () =>
              of([
                {
                  category: 'ContentStudio',
                  items: [
                    { key: 'ContentStudio:Enabled', value: 'false', isSecret: false, isList: false, description: null, options: ['true', 'false'] },
                    { key: 'ContentStudio:StorageMode', value: 'PublicBucket', isSecret: false, isList: false, description: null, options: ['PublicBucket', 'SignedUrls'] },
                    { key: 'ContentStudio:StorageKeyPrefix', value: 'studio', isSecret: false, isList: false, description: null },
                  ],
                },
              ]),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { categories: ['ContentStudio'] } } } },
        { provide: PlatformAiProvidersService, useValue: insightsStub() },
      ],
    });

    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('mat-slide-toggle').length).toBe(1);
    expect(root.querySelectorAll('mat-select').length).toBe(1);
    expect(root.querySelectorAll('input[type="text"]').length).toBe(1);
    expect(fixture.componentInstance.panels[0].form.get('ContentStudio:Enabled')?.value).toBe('false');

    // Flipping the toggle stores the text "true" and lets the panel be saved.
    const component = fixture.componentInstance;
    const item = component.panels[0].category.items.find((i) => i.key === 'ContentStudio:Enabled')!;
    expect(component.isOn(item)).toBeFalse();
    component.setSwitch(item, true);
    expect(component.panels[0].form.get('ContentStudio:Enabled')?.value).toBe('true');
    expect(component.panels[0].form.pristine).toBeFalse();
    expect(fixture.componentInstance.panels[0].form.get('ContentStudio:StorageMode')?.value).toBe('PublicBucket');
  });

  it('treats a true/false setting as an On/Off switch and anything else as a choice', () => {
    const component = SettingsListComponent.prototype;

    expect(component.isSwitch({ options: ['true', 'false'] } as SettingItem)).toBeTrue();
    expect(component.isSwitch({ options: ['PublicBucket', 'Private'] } as SettingItem)).toBeFalse();
    expect(component.isSwitch({ options: null } as SettingItem)).toBeFalse();
  });

  it('shows only the AI providers on its own screen', () => {
    expect(panelsFor({ categories: ['AiProviders'] })).toEqual(['AiProviders']);
  });

  it('shows everything but the AI providers on the System screen', () => {
    expect(panelsFor({ exclude: ['AiProviders'] })).toEqual(['Campaigns', 'Retention']);
  });

  it('shows the last recorded Verify, the accuracy test and a comparison beside the provider settings', () => {
    const item = (key: string) => ({ key, value: 'v', isSecret: false, isList: false, description: null });
    const openAi = insight('OpenAI', {
      status: 'Verified',
      lastCheckedAtUtc: '2026-10-19T09:00:00Z',
      lastCheckMessage: 'ChatGPT accepted the API key.',
      priceSet: true,
      inputPer1MUsd: 1,
      outputPer1MUsd: 2,
      benchmark: {
        passed: 5, total: 6, accuracyPercent: 83, averageLatencyMs: 900, totalCostUsd: 0.0021, inputTokens: 1800, outputTokens: 240,
        ranAtUtc: '2026-10-19T09:05:00Z', model: 'gpt-served', cases: [{ name: 'Consultation fee', passed: true, note: null }],
      },
    });
    const insights = insightsStub([openAi, insight('Google', { hasKey: false, status: 'NotConfigured' })]);
    insights.benchmark.and.returnValue(of(openAi));
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: SettingsService, useValue: { getAll: () => of([{ category: 'AiProviders', items: ['AiProviders:OpenAI:ApiKey', 'AiProviders:Google:ApiKey'].map(item) }]) } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { categories: ['AiProviders'] } } } },
        { provide: PlatformAiProvidersService, useValue: insights },
      ],
    });

    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="last-check"]')?.textContent).toContain('ChatGPT accepted the API key.');
    expect(Array.from(root.querySelectorAll('[data-testid="status"]')).map((e) => e.textContent?.trim())).toEqual(['Verified', 'No key saved']);
    expect(root.querySelector('[data-testid="benchmark-result"]')?.textContent).toContain('Accuracy 83%');
    expect(root.querySelector('[data-compare="OpenAI"]')?.textContent).toContain('$ 1 / $ 2');
    expect(root.querySelector('[data-compare="Google"]')?.textContent).toContain('Not tested');

    // A provider with no key cannot be tested; one with a key runs the test with the saved settings.
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-testid="benchmark"]'));
    expect(buttons.map((b) => b.disabled)).toEqual([false, true]);
    buttons[0].click();
    expect(insights.benchmark).toHaveBeenCalledWith('OpenAI');
  });

  it('lists every AI use of the application by area, says which a provider cannot run, and what runs on it now', () => {
    const item = (key: string) => ({ key, value: 'v', isSecret: false, isList: false, description: null });
    const claude = insight('Anthropic', { usedFor: ['Customer chat replies', 'Suggested answers'] });
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: SettingsService, useValue: { getAll: () => of([{ category: 'AiProviders', items: ['AiProviders:Anthropic:ApiKey'].map(item) }]) } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { categories: ['AiProviders'] } } } },
        { provide: PlatformAiProvidersService, useValue: insightsStub([claude]) },
      ],
    });
    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="used-for"]')?.textContent).toContain('Customer chat replies, Suggested answers');
    const toggle = Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes('What it can do'))!;
    expect(toggle.textContent).toContain('1 of 2 verified'); // embeddings are not counted: Claude cannot run them
    toggle.click();
    fixture.detectChanges();

    const list = root.querySelector('[data-testid="capabilities"]')!;
    expect(Array.from(list.querySelectorAll('h4')).map((h) => h.textContent?.trim())).toEqual(['Customer chat', 'Product knowledge']);
    expect(list.textContent).toContain('Replying to customers in WhatsApp');
    expect(list.textContent).toContain('not supported by this provider');
  });

  it('asks the insights service nothing on a screen without AI providers', () => {
    const insights = insightsStub();
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: SettingsService, useValue: { getAll: () => of([category('Campaigns')]) } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { exclude: ['AiProviders'] } } } },
        { provide: PlatformAiProvidersService, useValue: insights },
      ],
    });

    TestBed.createComponent(SettingsListComponent).detectChanges();

    expect(insights.get).not.toHaveBeenCalled();
  });
});
