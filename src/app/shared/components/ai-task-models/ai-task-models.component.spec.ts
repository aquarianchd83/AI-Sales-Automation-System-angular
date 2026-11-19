import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { AiTaskModelCell, AiTaskModels } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformAiProvidersService } from '../../../core/services/platform-ai-providers.service';
import { SharedModule } from '../../shared.module';
import { AiTaskModelsComponent } from './ai-task-models.component';

const priced = (model: string, input: number, output: number) => ({ model, hasPrice: true, inputPer1M: input, outputPer1M: output });

const cell = (provider: 'Anthropic' | 'OpenAI' | 'Google', extra: Partial<AiTaskModelCell> = {}): AiTaskModelCell => {
  const chat = provider === 'Anthropic' ? 'claude-haiku-4-5' : provider === 'OpenAI' ? 'gpt-5-nano' : 'gemini-flash-lite-latest';
  const hasPrice = provider !== 'Google';
  return {
    provider,
    providerLabel: provider === 'Anthropic' ? 'Claude' : provider === 'OpenAI' ? 'ChatGPT' : 'Gemini',
    available: true,
    chatModel: chat,
    selected: null,
    effectiveModel: chat,
    hasPrice,
    inputPer1M: hasPrice ? 1 : null,
    outputPer1M: hasPrice ? 5 : null,
    options:
      provider === 'Anthropic'
        ? [priced('claude-haiku-4-5', 1, 5), priced('claude-sonnet-5', 2, 10)]
        : provider === 'OpenAI'
        ? [priced('gpt-5-nano', 0.05, 0.4), priced('gpt-5', 1.25, 10)]
        : [{ model: 'gemini-flash-lite-latest', hasPrice: false, inputPer1M: null, outputPer1M: null }],
    ...extra,
  };
};

const page = (overrides: Partial<Record<string, Partial<AiTaskModelCell>>> = {}): AiTaskModels => ({
  groups: [
    { key: 'CustomerReplies', title: 'Customer replies', description: 'Fast and cheap.', tasks: ['Replying to customers in WhatsApp'], providers: [cell('Anthropic', overrides['Anthropic']), cell('OpenAI'), cell('Google', { available: false, ...overrides['Google'] })] },
    { key: 'ProductKnowledge', title: 'Product knowledge', description: 'Accurate.', tasks: ['Document and PDF analysis'], providers: [cell('Anthropic'), cell('OpenAI'), cell('Google', { available: false })] },
  ],
});

describe('AiTaskModelsComponent', () => {
  let fixture: ComponentFixture<AiTaskModelsComponent>;
  let component: AiTaskModelsComponent;
  let api: jasmine.SpyObj<PlatformAiProvidersService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => (el().textContent ?? '').replace(/\s+/g, ' ');
  const select = (group: string, provider: string) => el().querySelector<HTMLSelectElement>(`[data-group="${group}"] [data-provider="${provider}"] select`)!;
  const save = () => el().querySelector<HTMLButtonElement>('[data-testid="task-models-save"]')!;
  const choose = (group: string, provider: string, model: string) => {
    const s = select(group, provider);
    s.value = model;
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  function create(result: AiTaskModels = page()): void {
    api.taskModels.and.returnValue(of(result));
    fixture = TestBed.createComponent(AiTaskModelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    api = jasmine.createSpyObj('PlatformAiProvidersService', ['taskModels', 'updateTaskModels']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformAiProvidersService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
  });

  it('lists every task group with a column per provider', () => {
    create();

    expect(text()).toContain('Customer replies');
    expect(text()).toContain('Product knowledge');
    expect(Array.from(el().querySelectorAll('th')).map((th) => th.textContent!.trim())).toEqual(['Task group', 'Claude', 'ChatGPT', 'Gemini']);
    expect(el().querySelectorAll('select').length).toBe(6);
  });

  it('starts every group on "Same as chat model", naming the model that means', () => {
    create();

    const s = select('CustomerReplies', 'Anthropic');
    expect(s.value).toBe('');
    expect(s.options[0].textContent).toContain('Same as chat model (claude-haiku-4-5)');
  });

  it('shows the saved choice and its price', () => {
    create(page({ Anthropic: { selected: 'claude-sonnet-5', effectiveModel: 'claude-sonnet-5' } }));

    expect(select('CustomerReplies', 'Anthropic').value).toBe('claude-sonnet-5');
    expect(el().querySelector('[data-group="CustomerReplies"] [data-provider="Anthropic"] .price')!.textContent).toContain('$ 2 / $ 10');
  });

  it('offers each provider only its own models', () => {
    create();

    const options = Array.from(select('CustomerReplies', 'OpenAI').options).map((o) => o.value);
    expect(options).toEqual(['', 'gpt-5-nano', 'gpt-5']);
  });

  it('keeps Save off until something is picked, and picking the saved value again changes nothing', () => {
    create();
    expect(save().disabled).toBeTrue();

    choose('CustomerReplies', 'Anthropic', 'claude-sonnet-5');
    expect(save().disabled).toBeFalse();

    choose('CustomerReplies', 'Anthropic', '');
    expect(save().disabled).toBeTrue();
  });

  it('prices the pick before it is saved', () => {
    create();

    choose('ProductKnowledge', 'Anthropic', 'claude-sonnet-5');

    expect(el().querySelector('[data-group="ProductKnowledge"] [data-provider="Anthropic"] .price')!.textContent).toContain('$ 2 / $ 10');
  });

  it('warns about a model with no price, so its cost is not silently counted as free', () => {
    create(page({ Google: { available: true } }));

    const warning = el().querySelector('[data-testid="task-models-unpriced"]')!;
    expect(warning.textContent).toContain('Gemini gemini-flash-lite-latest');
    expect(warning.textContent).toContain('counted as free');
    expect(el().querySelector('[data-group="CustomerReplies"] [data-provider="Google"] .warn')!.textContent).toContain('No price');
  });

  it('does not warn about a provider that is off or has no key', () => {
    create(); // Gemini is unavailable and unpriced

    expect(el().querySelector('[data-testid="task-models-unpriced"]')).toBeNull();
    expect(text()).toContain('Off or no key, so this has no effect yet.');
  });

  it('saves only what was changed, and shows the saved page', () => {
    create();
    api.updateTaskModels.and.returnValue(of(page({ Anthropic: { selected: 'claude-sonnet-5', effectiveModel: 'claude-sonnet-5' } })));

    choose('CustomerReplies', 'Anthropic', 'claude-sonnet-5');
    save().click();
    fixture.detectChanges();

    expect(api.updateTaskModels).toHaveBeenCalledOnceWith([{ group: 'CustomerReplies', provider: 'Anthropic', model: 'claude-sonnet-5' }]);
    expect(notify.success).toHaveBeenCalled();
    expect(save().disabled).toBeTrue();
    expect(select('CustomerReplies', 'Anthropic').value).toBe('claude-sonnet-5');
  });

  it('sends a blank model to put a group back on the chat model', () => {
    create(page({ Anthropic: { selected: 'claude-sonnet-5', effectiveModel: 'claude-sonnet-5' } }));
    api.updateTaskModels.and.returnValue(of(page()));

    choose('CustomerReplies', 'Anthropic', '');
    save().click();

    expect(api.updateTaskModels).toHaveBeenCalledOnceWith([{ group: 'CustomerReplies', provider: 'Anthropic', model: '' }]);
  });

  it('keeps the picks and says why when the save fails', () => {
    create();
    api.updateTaskModels.and.returnValue(throwError(() => ({ error: { message: 'A model name has no spaces.' } })));

    choose('CustomerReplies', 'Anthropic', 'claude-sonnet-5');
    save().click();
    fixture.detectChanges();

    expect(notify.error).toHaveBeenCalledWith('A model name has no spaces.');
    expect(component.dirty).toBeTrue();
    expect(select('CustomerReplies', 'Anthropic').value).toBe('claude-sonnet-5');
  });

  it('discards the picks', () => {
    create();
    choose('CustomerReplies', 'Anthropic', 'claude-sonnet-5');

    el().querySelector<HTMLButtonElement>('[data-testid="task-models-discard"]')!.click();
    fixture.detectChanges();

    expect(select('CustomerReplies', 'Anthropic').value).toBe('');
    expect(component.dirty).toBeFalse();
  });

  it('says so when the choices cannot be loaded', () => {
    api.taskModels.and.returnValue(throwError(() => new Error('down')));
    fixture = TestBed.createComponent(AiTaskModelsComponent);
    fixture.detectChanges();

    expect(el().querySelector('[data-testid="task-models-failed"]')).not.toBeNull();
  });
});
