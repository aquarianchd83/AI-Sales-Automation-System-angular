import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { emptyPage } from '../../../core/models/paged-result.model';
import { AiExecution, AiPolicy, AiProvidersOverview } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformAiProvidersService } from '../../../core/services/platform-ai-providers.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformAiPolicyComponent } from './platform-ai-policy.component';

const policy = (over: Partial<AiPolicy> = {}): AiPolicy => ({
  fallbackEnabled: false,
  fallbackOrder: ['OpenAI', 'Google', 'Anthropic'],
  simulatorScenario: 'Success',
  maxCostPerCallUsd: 0.5,
  timeoutSeconds: 60,
  maxRetriesPerProvider: 1,
  scenarios: ['Success', 'MissingEvidence', 'Conflict', 'Malformed', 'ProviderError'],
  ...over,
});

const overview = (): AiProvidersOverview => ({ providers: [], policy: policy() });

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

describe('PlatformAiPolicyComponent', () => {
  let fixture: ComponentFixture<PlatformAiPolicyComponent>;
  let api: jasmine.SpyObj<PlatformAiProvidersService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const root = () => fixture.nativeElement as HTMLElement;

  function render(executions: AiExecution[] = [], get = of(overview())): HTMLElement {
    api = jasmine.createSpyObj('PlatformAiProvidersService', ['get', 'benchmark', 'updatePolicy', 'executions']);
    api.get.and.returnValue(get);
    api.executions.and.returnValue(of({ ...emptyPage<AiExecution>(), items: executions, totalCount: executions.length, page: 1, pageSize: 10 }));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [PlatformAiPolicyComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformAiProvidersService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(PlatformAiPolicyComponent);
    fixture.detectChanges();
    return root();
  }

  it('holds only the policy and the call log, and points to AI Providers for the providers themselves', () => {
    const el = render();

    expect(el.querySelector('[data-testid="policy"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="executions"]')).not.toBeNull();
    // No second place to edit a key, a model or On/Off, and no second Verify.
    expect(el.querySelector('input[type="password"]')).toBeNull();
    expect(el.querySelector('[data-testid="verify"]')).toBeNull();
    expect(el.querySelector('[data-provider]')).toBeNull();
    expect(el.querySelector('a[href="/settings/ai-providers"]')).not.toBeNull();
  });

  it('saves the policy: fallback order, cost limit and the simulator scenario', () => {
    render();
    api.updatePolicy.and.returnValue(of(policy({ fallbackEnabled: true, fallbackOrder: ['Google', 'OpenAI'], simulatorScenario: 'Conflict', maxCostPerCallUsd: 1 })));
    const component = fixture.componentInstance;

    component.policyFallback = true;
    component.removeFromOrder(2); // drop Claude
    component.moveUp(1); // Gemini before ChatGPT
    component.policyScenario = 'Conflict';
    component.policyMaxCost.setValue(1);
    component.savePolicy();

    expect(api.updatePolicy).toHaveBeenCalledWith({
      fallbackEnabled: true,
      fallbackOrder: ['Google', 'OpenAI'],
      simulatorScenario: 'Conflict',
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

  it('has no scanned-documents switch of its own: that is the scanned-pages task group above', () => {
    render();

    expect(root().querySelector('[data-testid="scanned"]')).toBeNull();
  });

  it('lists AI calls with mode, fallback, tokens and cost', () => {
    const el = render([
      execution(),
      execution({ id: 'e2', mode: 'Simulator', provider: 'Simulator', status: 'Failed', errorCode: 'MALFORMED_RESPONSE', fallbackFromProvider: null, attempt: 1, inputTokens: null, estimatedCostUsd: null }),
    ]);

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

  it('says so when the policy cannot be loaded', () => {
    render([], throwError(() => new Error('500')));

    expect(text(root())).toContain('could not be loaded');
    expect(root().querySelector('[data-testid="policy"]')).toBeNull();
  });
});
