import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { emptyPage } from '../../../core/models/paged-result.model';
import { AiExecution, AiPolicy, AiProviderPanel, AiProvidersOverview } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformAiProvidersService } from '../../../core/services/platform-ai-providers.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformAiProvidersComponent } from './platform-ai-providers.component';

const tasks = ['DocumentAnalysis', 'GroundedQuestionAnswering', 'ScannedDocumentReading'];

const panel = (provider: 'OpenAI' | 'Anthropic' | 'Google', over: Partial<AiProviderPanel> = {}): AiProviderPanel => ({
  provider,
  displayName: provider === 'OpenAI' ? 'ChatGPT' : provider === 'Anthropic' ? 'Claude' : 'Gemini',
  isSimulator: false,
  enabled: true,
  hasKey: true,
  keyHint: '••••1234',
  model: `${provider.toLowerCase()}-model`,
  status: 'NotVerified',
  lastCheckedAtUtc: null,
  lastCheckMessage: null,
  capabilities: tasks.map((task) => ({ task, declared: true, verified: false, verifiedAtUtc: null })),
  inputPer1MUsd: 0,
  outputPer1MUsd: 0,
  priceSet: false,
  benchmark: null,
  chosenForProductKnowledge: false,
  ...over,
});

const simulator: AiProviderPanel = {
  ...panel('OpenAI'),
  provider: 'Simulator',
  displayName: 'Simulator',
  isSimulator: true,
  hasKey: false,
  keyHint: null,
  model: null,
  status: 'Ready',
  lastCheckMessage: 'Returns fixed, labelled test data.',
  chosenForProductKnowledge: true,
};

const policy = (over: Partial<AiPolicy> = {}): AiPolicy => ({
  fallbackEnabled: false,
  fallbackOrder: ['OpenAI', 'Google', 'Anthropic'],
  simulatorScenario: 'Success',
  scannedDocumentsViaAi: false,
  maxCostPerCallUsd: 0.5,
  timeoutSeconds: 60,
  maxRetriesPerProvider: 1,
  scenarios: ['Success', 'MissingEvidence', 'Conflict', 'Malformed', 'ProviderError'],
  ...over,
});

const overview = (providers: AiProviderPanel[] = [simulator, panel('OpenAI'), panel('Anthropic', { hasKey: false, keyHint: null, status: 'NotConfigured' }), panel('Google', { enabled: false, status: 'Off' })]): AiProvidersOverview => ({
  providers,
  policy: policy(),
  chosenMode: 'Simulator',
  chosenProvider: 'Simulator',
});

const execution = (over: Partial<AiExecution> = {}): AiExecution => ({
  id: 'e1',
  correlationId: 'c1',
  task: 'GroundedQuestionAnswering',
  feature: 'ProductKnowledge',
  requestedProvider: 'OpenAI',
  provider: 'Google',
  model: 'gemini-model',
  mode: 'Live',
  status: 'Succeeded',
  attempt: 2,
  fallbackFromProvider: 'OpenAI',
  durationMs: 1234,
  inputTokens: 1000,
  outputTokens: 200,
  estimatedCostUsd: 0.0014,
  errorCode: null,
  errorSummary: null,
  createdAt: '2026-10-19T09:00:00Z',
  ...over,
});

describe('PlatformAiProvidersComponent', () => {
  let fixture: ComponentFixture<PlatformAiProvidersComponent>;
  let api: jasmine.SpyObj<PlatformAiProvidersService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const root = () => fixture.nativeElement as HTMLElement;
  const card = (provider: string) => root().querySelector(`[data-provider="${provider}"]`) as HTMLElement;
  const click = (el: Element | null) => {
    (el as HTMLElement).click();
    fixture.detectChanges();
  };

  function render(initial: AiProvidersOverview = overview(), executions: AiExecution[] = []): HTMLElement {
    api = jasmine.createSpyObj('PlatformAiProvidersService', ['get', 'update', 'verify', 'benchmark', 'updatePolicy', 'executions']);
    api.get.and.returnValue(of(initial));
    api.executions.and.returnValue(of({ ...emptyPage<AiExecution>(), items: executions, totalCount: executions.length, page: 1, pageSize: 10 }));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [PlatformAiProvidersComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformAiProvidersService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(PlatformAiProvidersComponent);
    fixture.detectChanges();
    return root();
  }

  // ----- the cards ----------------------------------------------------------------------------------------------------------------

  it('shows the simulator and one card per provider, with a plain status and what product knowledge runs on', () => {
    const el = render();

    expect(card('Simulator')).not.toBeNull();
    expect(text(card('Simulator'))).toContain('Used for product knowledge');
    expect(text(card('OpenAI').querySelector('[data-testid="status"]'))).toBe('Not verified yet');
    expect(text(card('Anthropic').querySelector('[data-testid="status"]'))).toBe('No key saved');
    expect(text(card('Google').querySelector('[data-testid="status"]'))).toBe('Switched off');
    expect(text(el.querySelector('.section-head'))).toContain('currently runs on the Simulator');
  });

  it('never shows a saved key, only its masked hint, and starts the key field empty', () => {
    render();

    const input = card('OpenAI').querySelector('[data-testid="key"]') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('Saved: ••••1234');
    expect(text(card('OpenAI'))).toContain('It is never shown again');
  });

  it('switches a provider on or off at once and shows the saved state', () => {
    render();
    api.update.and.returnValue(of(panel('Google', { enabled: true, status: 'NotVerified' })));

    fixture.componentInstance.setEnabled(fixture.componentInstance.overview!.providers[3], true);
    fixture.detectChanges();

    expect(api.update).toHaveBeenCalledWith('Google', { enabled: true });
    expect(notify.success).toHaveBeenCalledWith('Gemini is switched on.');
    expect(text(card('Google').querySelector('[data-testid="status"]'))).toBe('Not verified yet');
  });

  it('reloads after a refused change, so a toggle never shows a state that was not saved', () => {
    render();
    api.update.and.returnValue(throwError(() => new Error('400')));

    fixture.componentInstance.setEnabled(fixture.componentInstance.overview!.providers[1], false);

    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('saves a new key, clears the field, and does nothing for an empty key', () => {
    render();
    api.update.and.returnValue(of(panel('OpenAI', { keyHint: '••••9999' })));
    const component = fixture.componentInstance;
    const openAi = component.overview!.providers[1];

    component.saveKey(openAi);
    expect(api.update).not.toHaveBeenCalled();

    component.draft('OpenAI').apiKey.setValue('  sk-new-key-9999  ');
    component.saveKey(openAi);
    fixture.detectChanges();

    expect(api.update).toHaveBeenCalledWith('OpenAI', { apiKey: 'sk-new-key-9999' });
    expect(component.draft('OpenAI').apiKey.value).toBe('');
    expect((card('OpenAI').querySelector('[data-testid="key"]') as HTMLInputElement).placeholder).toBe('Saved: ••••9999');
  });

  it('saves the model only when it changed', () => {
    render();
    api.update.and.returnValue(of(panel('OpenAI', { model: 'gpt-new' })));
    const component = fixture.componentInstance;
    const openAi = component.overview!.providers[1];

    component.saveModel(openAi);
    expect(api.update).not.toHaveBeenCalled();

    component.draft('OpenAI').model.setValue('gpt-new');
    component.saveModel(openAi);
    expect(api.update).toHaveBeenCalledWith('OpenAI', { model: 'gpt-new' });
  });

  it('saves prices and refuses a negative one', () => {
    render();
    api.update.and.returnValue(of(panel('OpenAI', { inputPer1MUsd: 0.25, outputPer1MUsd: 2, priceSet: true })));
    const component = fixture.componentInstance;
    const openAi = component.overview!.providers[1];

    component.draft('OpenAI').inputPrice.setValue(-1);
    component.savePrice(openAi);
    expect(api.update).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();

    component.draft('OpenAI').inputPrice.setValue(0.25);
    component.draft('OpenAI').outputPrice.setValue(2);
    component.savePrice(openAi);
    expect(api.update).toHaveBeenCalledWith('OpenAI', { inputPer1MUsd: 0.25, outputPer1MUsd: 2 });
  });

  it('only offers verify and the accuracy test for a provider that is on and has a key', () => {
    render();

    expect((card('OpenAI').querySelector('[data-testid="verify"]') as HTMLButtonElement).disabled).toBeFalse();
    expect((card('Anthropic').querySelector('[data-testid="verify"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((card('Google').querySelector('[data-testid="benchmark"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('verifies a provider with a real call and shows the outcome and the new status', () => {
    render();
    api.verify.and.returnValue(
      of({ success: true, message: 'ChatGPT accepted the key and the model gpt-served answered.', provider: panel('OpenAI', { status: 'Verified', lastCheckedAtUtc: '2026-10-19T09:00:00Z' }) })
    );

    click(card('OpenAI').querySelector('[data-testid="verify"]'));

    expect(api.verify).toHaveBeenCalledWith('OpenAI');
    expect(text(card('OpenAI').querySelector('[data-testid="check-result"]'))).toContain('gpt-served answered');
    expect(text(card('OpenAI').querySelector('[data-testid="status"]'))).toBe('Verified');
    expect(api.executions).toHaveBeenCalledTimes(2); // the call log refreshes, since a check is a logged call
  });

  it('shows a failed check as a failure', () => {
    render();
    api.verify.and.returnValue(of({ success: false, message: 'ChatGPT rejected the API key (HTTP 401).', provider: panel('OpenAI', { status: 'Failed' }) }));

    click(card('OpenAI').querySelector('[data-testid="verify"]'));

    expect(card('OpenAI').querySelector('.test-result--fail')).not.toBeNull();
    expect(text(card('OpenAI').querySelector('[data-testid="status"]'))).toBe('Check failed');
  });

  // ----- accuracy and cost ----------------------------------------------------------------------------------------------------------

  const benchmarked = (over: Partial<AiProviderPanel> = {}) =>
    panel('OpenAI', {
      priceSet: true,
      inputPer1MUsd: 1,
      outputPer1MUsd: 2,
      benchmark: {
        passed: 5,
        total: 6,
        accuracyPercent: 83,
        averageLatencyMs: 812,
        totalCostUsd: 0.00228,
        inputTokens: 1800,
        outputTokens: 240,
        ranAtUtc: '2026-10-19T09:00:00Z',
        model: 'gpt-served',
        cases: [
          { name: 'Direct fact (fee)', passed: true, note: null },
          { name: 'Not stated (LASIK)', passed: false, note: 'It gave an answer the text does not support.' },
        ],
      },
      ...over,
    });

  it('runs the accuracy test and shows the measured accuracy, speed, tokens and cost, with the failing cases', () => {
    render();
    api.benchmark.and.returnValue(of(benchmarked()));

    click(card('OpenAI').querySelector('[data-testid="benchmark"]'));

    expect(api.benchmark).toHaveBeenCalledWith('OpenAI');
    const result = text(card('OpenAI').querySelector('[data-testid="benchmark-result"]'));
    expect(result).toContain('Accuracy 83%');
    expect(result).toContain('5 of 6 passed');
    expect(result).toContain('812 ms');
    expect(result).toContain('$ 0.00228');
    expect(result).toContain('1,800 in / 240 out tokens');
    expect(result).toContain('It gave an answer the text does not support.'); // details open after a run
    expect(notify.success).toHaveBeenCalledWith('ChatGPT: 5 of 6 test questions passed.');
  });

  it('compares the providers side by side on measured accuracy and cost', () => {
    const el = render(overview([simulator, benchmarked(), panel('Anthropic'), panel('Google')]));

    const row = text(el.querySelector('[data-compare="OpenAI"]'));
    expect(row).toContain('ChatGPT');
    expect(row).toContain('83% (5/6)');
    expect(row).toContain('812 ms');
    expect(row).toContain('$ 0.00228');
    expect(row).toContain('$ 1 / $ 2');
    expect(text(el.querySelector('[data-compare="Anthropic"]'))).toContain('Not tested');
    expect(text(el.querySelector('[data-compare="Anthropic"]'))).toContain('Not set');
    expect(el.querySelector('[data-compare="Simulator"]')).toBeNull();
  });

  it('separates what a provider is declared to do from what a real call has verified', () => {
    const verified = panel('OpenAI', {
      capabilities: [
        { task: 'GroundedQuestionAnswering', declared: true, verified: true, verifiedAtUtc: '2026-10-19T09:00:00Z' },
        { task: 'DocumentAnalysis', declared: true, verified: false, verifiedAtUtc: null },
      ],
    });
    render(overview([simulator, verified, panel('Anthropic'), panel('Google')]));

    expect(text(card('OpenAI').querySelector('.capabilities'))).toContain('1 of 2 verified by a real call');
    click(card('OpenAI').querySelector('.capabilities button'));

    const items = Array.from(card('OpenAI').querySelectorAll('[data-testid="capabilities"] li')).map((li) => text(li));
    expect(items[0]).toContain('Question answering from sources');
    expect(items[0]).toContain('verified');
    expect(items[1]).toContain('supported, not verified yet');
  });

  // ----- policy -------------------------------------------------------------------------------------------------------------------

  it('saves the policy: fallback order, scanned documents, cost limit and the simulator scenario', () => {
    render();
    api.updatePolicy.and.returnValue(of(policy({ fallbackEnabled: true, fallbackOrder: ['Google', 'OpenAI'], scannedDocumentsViaAi: true, simulatorScenario: 'Conflict', maxCostPerCallUsd: 1 })));
    const component = fixture.componentInstance;

    component.policyFallback = true;
    component.removeFromOrder(2); // drop Claude
    component.moveUp(1); // Gemini before ChatGPT
    component.policyScanned = true;
    component.policyScenario = 'Conflict';
    component.policyMaxCost.setValue(1);
    component.savePolicy();

    expect(api.updatePolicy).toHaveBeenCalledWith({
      fallbackEnabled: true,
      fallbackOrder: ['Google', 'OpenAI'],
      simulatorScenario: 'Conflict',
      scannedDocumentsViaAi: true,
      maxCostPerCallUsd: 1,
    });
    expect(notify.success).toHaveBeenCalledWith('AI policy saved.');
    expect(component.fallbackCandidates).toEqual(['Anthropic']);
  });

  it('refuses a negative cost limit', () => {
    render();
    fixture.componentInstance.policyMaxCost.setValue(-2);

    fixture.componentInstance.savePolicy();

    expect(api.updatePolicy).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('warns that scanned pages leave the platform when that switch is on', () => {
    render();
    fixture.componentInstance.policyScanned = true;
    fixture.detectChanges();

    const note = root().querySelector('[data-testid="policy"] .warn');
    expect(text(note)).toContain('sent to the chosen AI provider');
  });

  // ----- the call log -------------------------------------------------------------------------------------------------------------

  it('lists AI calls with mode, fallback, tokens and cost', () => {
    const el = render(overview(), [execution(), execution({ id: 'e2', mode: 'Simulator', provider: 'Simulator', status: 'Failed', errorCode: 'MALFORMED_RESPONSE', fallbackFromProvider: null, attempt: 1, inputTokens: null, estimatedCostUsd: null })]);

    const rows = Array.from(el.querySelectorAll('[data-testid="executions"] tr.mat-mdc-row')).map((r) => text(r));
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Question answering from sources · attempt 2');
    expect(rows[0]).toContain('Gemini (after ChatGPT failed)');
    expect(rows[0]).toContain('Live');
    expect(rows[0]).toContain('1,000 / 200');
    expect(rows[0]).toContain('$ 0.0014');
    expect(rows[1]).toContain('Simulator');
    expect(rows[1]).toContain('MALFORMED_RESPONSE');
  });

  it('says so when there are no calls yet', () => {
    const el = render();

    expect(text(el.querySelector('[data-testid="executions"]'))).toContain('No AI calls yet.');
  });

  it('says so when the providers cannot be loaded, and can try again', () => {
    api = jasmine.createSpyObj('PlatformAiProvidersService', ['get', 'executions']);
    api.get.and.returnValue(throwError(() => new Error('500')));
    api.executions.and.returnValue(of(emptyPage<AiExecution>()));
    TestBed.configureTestingModule({
      declarations: [PlatformAiProvidersComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformAiProvidersService, useValue: api },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    });
    fixture = TestBed.createComponent(PlatformAiProvidersComponent);
    fixture.detectChanges();

    expect(text(root())).toContain('could not be loaded');
  });
});
