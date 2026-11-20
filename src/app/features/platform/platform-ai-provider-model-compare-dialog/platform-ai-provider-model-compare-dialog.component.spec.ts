import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AiProviderModel } from '../../../core/models/platform.model';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformAiProviderModelCompareDialogComponent } from './platform-ai-provider-model-compare-dialog.component';

const model = (over: Partial<AiProviderModel>): AiProviderModel => ({
  id: over.modelId ?? 'm',
  provider: 'Anthropic',
  displayName: 'Model',
  modelId: 'model',
  modelType: 'Chat',
  contextWindowTokens: null,
  maxOutputTokens: null,
  inputPricePer1MUsd: 1,
  outputPricePer1MUsd: 5,
  costTier: 'Cheap',
  bestFor: [],
  description: null,
  isActive: true,
  isDefault: false,
  createdAt: '2026-11-20T00:00:00Z',
  ...over,
});

describe('PlatformAiProviderModelCompareDialogComponent', () => {
  function create(models: AiProviderModel[]): ComponentFixture<PlatformAiProviderModelCompareDialogComponent> {
    TestBed.configureTestingModule({
      declarations: [PlatformAiProviderModelCompareDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: { models } }],
    });
    const fixture = TestBed.createComponent(PlatformAiProviderModelCompareDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  const text = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? '';

  it('puts each model under the provider and task it is recommended for, cheapest first', () => {
    const fixture = create([
      model({ modelId: 'haiku', displayName: 'Claude Haiku 4.5', bestFor: ['customer-replies'] }),
      model({ modelId: 'opus', displayName: 'Claude Opus 5', costTier: 'Expensive', outputPricePer1MUsd: 25, bestFor: ['customer-replies', 'content-studio'] }),
      model({ modelId: 'nano', provider: 'OpenAI', displayName: 'GPT-5 nano', bestFor: ['customer-replies'] }),
    ]);

    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
    const replies = rows[0].textContent ?? '';
    expect(replies).toContain('Customer WhatsApp replies');
    expect(replies.indexOf('Claude Haiku 4.5')).toBeGreaterThan(-1);
    expect(replies.indexOf('Claude Haiku 4.5')).toBeLessThan(replies.indexOf('Claude Opus 5'));
    expect(replies).toContain('GPT-5 nano');
    expect(rows[7].textContent).toContain('Claude Opus 5');
    expect(rows[7].textContent).not.toContain('GPT-5 nano');
  });

  it('leaves out a model that is switched off, and shows a dash where a provider has no pick', () => {
    const fixture = create([
      model({ modelId: 'haiku', displayName: 'Claude Haiku 4.5', bestFor: ['customer-replies'] }),
      model({ modelId: 'old', displayName: 'Retired model', isActive: false, bestFor: ['customer-replies'] }),
      model({ modelId: 'nano', provider: 'OpenAI', displayName: 'GPT-5 nano', bestFor: ['content-studio'] }),
    ]);

    expect(text(fixture)).not.toContain('Retired model');
    const first = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'))[0];
    expect(first.querySelectorAll('td')[2].textContent).toContain('–');
  });

  it('says so when no model has a task yet', () => {
    const fixture = create([model({ modelId: 'haiku', bestFor: [] })]);

    expect(text(fixture)).toContain('No active model has a "Best for" task yet');
    expect((fixture.nativeElement as HTMLElement).querySelector('table')).toBeNull();
  });
});
