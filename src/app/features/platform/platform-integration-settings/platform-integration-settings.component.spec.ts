import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  AiConversationChannel,
  AiFeatureChannel,
  AiToolProvider,
  IntegrationChannel,
  PlatformAiFeatureSettings,
  PlatformIntegrationSettings,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformIntegrationSettingsService } from '../../../core/services/platform-integration-settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformIntegrationSettingsComponent } from './platform-integration-settings.component';

/** The AI providers section has its own spec; here it only needs to exist. */
@Component({ selector: 'app-platform-ai-policy', template: '' })
class AiPolicyStubComponent {}

const channel = (over: Partial<IntegrationChannel> = {}): IntegrationChannel => ({
  mode: 'Simulator',
  apiUrl: '',
  apiKeyHeader: 'Authorization',
  senderId: '',
  timeoutSeconds: 15,
  hasApiKey: false,
  apiKeyHint: null,
  isLive: false,
  ...over,
});

const stored = (over: Partial<PlatformIntegrationSettings> = {}): PlatformIntegrationSettings => ({
  consentSms: channel(),
  dndCheck: channel(),
  ...over,
});

const ALL_TOOLS: AiToolProvider[] = ['OpenAI', 'Anthropic', 'Google'];

/** A feature that supports no third-party tool yet (knowledge base, content generation, video renders). */
const aiChannel = (over: Partial<AiFeatureChannel> = {}): AiFeatureChannel => ({
  mode: 'Simulator',
  provider: 'OpenAI',
  providerHasKey: true,
  isLive: false,
  supportedProviders: [],
  savedProviderSupported: true,
  ...over,
});

/** Discovery lead supports Claude only. */
const discovery = (over: Partial<AiFeatureChannel> = {}): AiFeatureChannel =>
  aiChannel({ mode: 'Api', provider: 'Anthropic', isLive: true, supportedProviders: ['Anthropic'], ...over });

const conversation = (over: Partial<AiConversationChannel> = {}): AiConversationChannel => ({
  mode: 'Api',
  provider: 'OpenAI',
  providerHasKey: true,
  embeddingMode: 'Api',
  embeddingProvider: 'OpenAI',
  embeddingProviderHasKey: true,
  isLive: true,
  supportedProviders: ALL_TOOLS,
  supportedEmbeddingProviders: ['OpenAI', 'Google'],
  ...over,
});

const aiStored = (over: Partial<PlatformAiFeatureSettings> = {}): PlatformAiFeatureSettings => ({
  conversation: conversation(),
  discoveryLead: discovery(),
  knowledgeBase: aiChannel(),
  contentGeneration: aiChannel(),
  videoRenders: aiChannel(),
  businessKeywords: aiChannel({ mode: 'Api', provider: 'Anthropic', supportedProviders: ['Anthropic', 'OpenAI', 'Google'] }),
  discoveryKeywords: aiChannel({ mode: 'Api', provider: 'Anthropic', supportedProviders: ['Anthropic', 'OpenAI', 'Google'] }),
  productKnowledgeTasks: [
    ['ProductDocumentReading', 'Reading documents and PDFs', 'Simulator'],
    ['ProductScannedReading', 'Reading scanned pages and images', 'Off'],
    ['ProductSuggestedAnswers', 'Suggested answers', 'Simulator'],
    ['ProductQuestionnaire', 'Questionnaire and benefits', 'Simulator'],
    ['ProductGapCheck', 'Gaps and conflicts check', 'Simulator'],
    ['ProductKnowledgeDraft', 'Draft knowledge file', 'Simulator'],
  ].map(([feature, title, mode]) => ({
    feature,
    title,
    description: '',
    tasks: [],
    channel: aiChannel({ mode: mode as AiFeatureChannel['mode'], provider: 'OpenAI', supportedProviders: ['OpenAI', 'Anthropic', 'Google'] }),
  })),
  ...over,
});

describe('PlatformIntegrationSettingsComponent', () => {
  let service: jasmine.SpyObj<PlatformIntegrationSettingsService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const create = (settings: PlatformIntegrationSettings, ai: PlatformAiFeatureSettings = aiStored()) => {
    service = jasmine.createSpyObj('PlatformIntegrationSettingsService', [
      'get', 'save', 'getAiFeatures', 'saveAiFeatures', 'testAiFeature', 'testConsentSms', 'testDndCheck',
    ]);
    service.get.and.returnValue(of(settings));
    service.save.and.callFake(() => of(settings));
    service.getAiFeatures.and.returnValue(of(ai));
    service.saveAiFeatures.and.callFake(() => of(ai));
    service.testAiFeature.and.returnValue(of({ success: true, message: 'ChatGPT answered' }));
    service.testConsentSms.and.returnValue(of({ success: true, message: 'accepted' }));
    service.testDndCheck.and.returnValue(of({ success: true, message: 'passes' }));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [PlatformIntegrationSettingsComponent, AiPolicyStubComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformIntegrationSettingsService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });

    const fixture = TestBed.createComponent(PlatformIntegrationSettingsComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  /** Opens one item of the console on the right, as clicking it in the list does. */
  const open = (fixture: { componentInstance: PlatformIntegrationSettingsComponent; detectChanges(): void; nativeElement: HTMLElement }, id: string) => {
    (fixture.nativeElement.querySelector(`[data-nav="${id}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('lists every service and AI feature on the left with what it runs on, and opens one at a time on the right', () => {
    const { fixture, component } = create(stored());
    const root = fixture.nativeElement as HTMLElement;

    const nav = Array.from(root.querySelectorAll('[data-nav]')).map((e) => e.getAttribute('data-nav'));
    expect(nav).toEqual([
      'conversation', 'consentSms', 'dndCheck', 'discoveryLead', 'discoveryKeywords', 'businessKeywords', 'knowledgeBase', 'contentGeneration',
      'videoRenders', 'productDocumentReading', 'productScannedReading', 'productSuggestedAnswers', 'productQuestionnaire', 'productGapCheck',
      'productKnowledgeDraft', 'policy', 'calls',
    ]);
    expect(root.querySelector('[data-nav="discoveryLead"] .pill')?.textContent?.trim()).toBe('Claude');
    expect(root.querySelector('[data-nav="productScannedReading"] .pill')?.textContent?.trim()).toBe('Off');
    expect(root.querySelector('[data-nav="consentSms"] .pill')?.textContent?.trim()).toBe('Simulator');

    // Conversations open first; one panel at a time.
    expect(root.querySelectorAll('mat-card.panel').length).toBe(1);
    expect(root.querySelector('[data-panel="conversation"]')).not.toBeNull();
    open(fixture, 'knowledgeBase');
    expect(root.querySelectorAll('mat-card.panel').length).toBe(1);
    expect(root.querySelector('[data-feature="KnowledgeBase"]')).not.toBeNull();
    expect(component.selected).toBe('knowledgeBase');
  });

  it('marks an item with an unsaved change and offers one Save for everything', () => {
    const { fixture, component } = create(stored());
    const root = open(fixture, 'productSuggestedAnswers');

    expect(root.querySelector('[data-testid="unsaved"]')).toBeNull();
    component.setEngine('productSuggestedAnswers', 'Anthropic');
    fixture.detectChanges();

    expect(root.querySelector('[data-nav="productSuggestedAnswers"] .nav-dirty')).not.toBeNull();
    expect(root.querySelector('[data-nav="productSuggestedAnswers"] .pill')?.textContent?.trim()).toBe('Claude');
    expect(root.querySelector('[data-testid="unsaved"]')).not.toBeNull();
    (root.querySelector('[data-testid="save"]') as HTMLButtonElement).click();
    expect(service.saveAiFeatures.calls.mostRecent().args[0].productKnowledgeTasks.find((g) => g.feature === 'ProductSuggestedAnswers'))
      .toEqual({ feature: 'ProductSuggestedAnswers', mode: 'Api', provider: 'Anthropic' });
  });

  it('shows a tool that cannot run (switched off under AI Providers) in amber, not as live', () => {
    const { fixture } = create(stored(), aiStored({ discoveryKeywords: aiChannel({
      mode: 'Api', provider: 'OpenAI', providerHasKey: false, providerEnabled: false, supportedProviders: ['Anthropic', 'OpenAI', 'Google'],
    }) }));

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-nav="discoveryKeywords"] .pill--warn')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-nav="discoveryLead"] .pill--live')).not.toBeNull();
  });

  it('starts on the simulator for both services and shows no API fields', () => {
    const { fixture, component } = create(stored());

    expect(component.isApi('consentSms')).toBeFalse();
    expect(component.isApi('dndCheck')).toBeFalse();
    const root = open(fixture, 'consentSms');
    expect(root.querySelector('[data-panel="consentSms"] h2')?.textContent).toContain('Consent SMS');
    expect(root.querySelector('[data-panel="consentSms"]')?.textContent).toContain('nothing leaves the platform');
    expect(root.querySelector('input[formcontrolname="apiUrl"]')).toBeNull();
    open(fixture, 'dndCheck');
    expect(root.querySelector('[data-panel="dndCheck"] h2')?.textContent).toContain('DND check');
  });

  it('shows the API fields for a service switched to the third-party API, and the key only as a hint', () => {
    const { fixture, component } = create(
      stored({ consentSms: channel({ mode: 'Api', apiUrl: 'https://sms.example.com/send', hasApiKey: true, apiKeyHint: '••••1234', isLive: true }) })
    );

    expect(component.isApi('consentSms')).toBeTrue();
    expect(component.isApi('dndCheck')).toBeFalse();
    expect(component.form.controls.consentSms.controls.apiKey.value).toBe('');
    expect(component.storedHint('consentSms')).toBe('••••1234');
    expect(open(fixture, 'consentSms').querySelectorAll('input[formcontrolname="apiUrl"]').length).toBe(1);
  });

  it('saves a blank key as null (keep) and a removed key as an empty string (clear)', () => {
    const { component } = create(stored({ consentSms: channel({ mode: 'Api', apiUrl: 'https://sms.example.com/send', hasApiKey: true, apiKeyHint: '••••1234', isLive: true }) }));

    component.form.controls.consentSms.controls.senderId.setValue('SALESX');
    component.form.controls.consentSms.controls.senderId.markAsDirty();
    component.save();
    expect(service.save.calls.mostRecent().args[0].consentSms.apiKey).toBeNull();
    expect(service.save.calls.mostRecent().args[0].consentSms.senderId).toBe('SALESX');

    component.form.controls.consentSms.controls.removeApiKey.setValue(true);
    component.form.controls.consentSms.controls.removeApiKey.markAsDirty();
    component.save();
    expect(service.save.calls.mostRecent().args[0].consentSms.apiKey).toBe('');
    expect(notify.success).toHaveBeenCalled();
  });

  it('refuses to save an address that is not https', () => {
    const { component } = create(stored());

    component.form.controls.dndCheck.controls.mode.setValue('Api');
    component.form.controls.dndCheck.controls.apiUrl.setValue('http://dnd.example.com');
    component.form.markAsDirty();
    component.save();

    expect(service.save).not.toHaveBeenCalled();
  });

  it('tests each service with what is on screen and shows the outcome until the form changes', () => {
    const { component } = create(stored({ dndCheck: channel({ mode: 'Api', apiUrl: 'https://dnd.example.com/check', hasApiKey: true, apiKeyHint: '••••5678', isLive: true }) }));

    component.testTo.dndCheck.setValue('+919876543210');
    component.test('dndCheck');

    const request = service.testDndCheck.calls.mostRecent().args[0];
    expect(request.to).toBe('+919876543210');
    expect(request.settings.mode).toBe('Api');
    expect(request.settings.apiKey).toBeNull();
    expect(component.results.dndCheck?.message).toBe('passes');

    component.form.controls.dndCheck.controls.timeoutSeconds.setValue(30);
    expect(component.results.dndCheck).toBeNull();
  });

  it('does not test without a valid number', () => {
    const { component } = create(stored());

    component.testTo.consentSms.setValue('9876543210');
    component.test('consentSms');

    expect(service.testConsentSms).not.toHaveBeenCalled();
  });

  describe('AI feature panels', () => {
    /** The choices a segmented control offers that can be picked (disabled ones are not offered). */
    const labels = (root: HTMLElement, group: string) =>
      Array.from(root.querySelectorAll(`mat-button-toggle-group[aria-label="${group}"] mat-button-toggle`))
        .filter((e) => !e.classList.contains('mat-button-toggle-disabled'))
        .map((e) => e.textContent?.replace(/science|block/g, '').trim());

    it('has a panel for each AI feature', () => {
      const { fixture } = create(stored());

      for (const [id, title] of [['conversation', 'Customer conversations'], ['discoveryLead', 'Discovery lead'], ['knowledgeBase', 'Knowledge base'],
        ['contentGeneration', 'Content generation'], ['videoRenders', 'Video renders']]) {
        expect(open(fixture, id).querySelector('mat-card.panel h2')?.textContent).toContain(title);
      }
    });

    it('offers Claude only for discovery lead, whatever other keys exist', () => {
      const { fixture, component } = create(stored());

      expect(component.toolsFor('discoveryLead').map((t) => t.label)).toEqual(['Claude']);
      expect(labels(open(fixture, 'discoveryLead'), 'Discovery lead runs on')).toEqual(['Simulator', 'Claude']);
    });

    it('offers ChatGPT, Claude and Gemini for the conversation and ChatGPT and Gemini for embeddings', () => {
      const { fixture, component } = create(stored());

      expect(component.conversationTools.map((t) => t.label)).toEqual(['ChatGPT', 'Claude', 'Gemini']);
      expect(component.embeddingTools.map((t) => t.label)).toEqual(['ChatGPT', 'Gemini']);
      const root = open(fixture, 'conversation');
      expect(labels(root, 'Customer replies run on')).toEqual(['Simulator', 'ChatGPT', 'Claude', 'Gemini']);
      expect(labels(root, 'Embeddings run on')).toEqual(['Simulator', 'ChatGPT', 'Gemini']);
    });

    it('lets a provider be added to one feature without showing it on another', () => {
      const { component } = create(
        stored(),
        aiStored({ discoveryLead: discovery({ supportedProviders: ['Anthropic', 'Google'] }) })
      );

      expect(component.toolsFor('discoveryLead').map((t) => t.label)).toEqual(['Claude', 'Gemini']);
      expect(component.conversationTools.map((t) => t.label)).toEqual(['ChatGPT', 'Claude', 'Gemini']);
      expect(component.toolsFor('knowledgeBase')).toEqual([]);
    });

    it('says a feature with no tool yet is simulator-only and disables the third-party choice', () => {
      const { fixture, component } = create(stored());

      expect(component.noToolYet('knowledgeBase')).toBeTrue();
      expect(component.noToolYet('discoveryLead')).toBeFalse();
      const root = open(fixture, 'knowledgeBase');
      expect(root.textContent).toContain('not connected to a third-party tool yet');
      expect(labels(root, 'Knowledge base runs on')).toEqual(['Simulator']);
    });

    it('switching to a third-party tool picks one the feature supports', () => {
      const { component } = create(stored(), aiStored({ discoveryLead: discovery({ mode: 'Simulator', provider: 'OpenAI' }) }));

      component.aiForm.controls.discoveryLead.controls.mode.setValue('Api');

      expect(component.aiForm.controls.discoveryLead.controls.provider.value).toBe('Anthropic');
    });

    it('warns about a saved tool the feature cannot run on and keeps it as saved', () => {
      const { fixture, component } = create(
        stored(),
        aiStored({ discoveryLead: discovery({ provider: 'OpenAI', isLive: false, savedProviderSupported: false }) })
      );

      expect(component.savedToolUnsupported('discoveryLead')).toBeTrue();
      expect(open(fixture, 'discoveryLead').textContent).toContain('The tool saved earlier (ChatGPT) is not available for this feature');
      expect(component.aiForm.controls.discoveryLead.controls.provider.value).toBe('OpenAI');
      expect(component.dirty).toBeFalse();
    });

    it('saves only the AI choices when only they changed', () => {
      const { component } = create(stored());

      component.aiForm.controls.discoveryLead.controls.mode.setValue('Simulator');
      component.aiForm.markAsDirty();
      component.save();

      expect(service.save).not.toHaveBeenCalled();
      const request = service.saveAiFeatures.calls.mostRecent().args[0];
      expect(request.discoveryLead).toEqual({ mode: 'Simulator', provider: 'Anthropic' });
      expect(request.knowledgeBase).toEqual({ mode: 'Simulator', provider: 'OpenAI' });
      expect(notify.success).toHaveBeenCalled();
      expect(component.dirty).toBeFalse();
    });

    it('shows what the AI conversation runs on and saves a changed choice with the embeddings tool', () => {
      const { fixture, component } = create(stored(), aiStored({ conversation: conversation({ provider: 'Anthropic', embeddingProvider: 'Google' }) }));

      expect(open(fixture, 'conversation').querySelector('[data-panel="conversation"] h2')?.textContent).toContain('Customer conversations');
      expect(component.isConversationThirdParty()).toBeTrue();
      expect(component.chatEngine()).toBe('Anthropic');
      expect(component.aiForm.controls.conversation.controls.provider.value).toBe('Anthropic');

      component.aiForm.controls.conversation.controls.embeddingProvider.setValue('OpenAI');
      component.aiForm.markAsDirty();
      component.save();

      expect(service.saveAiFeatures.calls.mostRecent().args[0].conversation).toEqual({
        mode: 'Api', provider: 'Anthropic', embeddingMode: 'Api', embeddingProvider: 'OpenAI',
      });
    });

    it('warns about a missing embeddings key', () => {
      const { fixture, component } = create(stored(), aiStored({ conversation: conversation({ embeddingProvider: 'Google', embeddingProviderHasKey: false }) }));

      expect(component.conversationHasKey(true)).toBeFalse();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No Gemini key is saved yet');
    });

    it('warns when the picked tool has no saved key, with a link to where to add it', () => {
      const { fixture, component } = create(stored(), aiStored({ discoveryLead: discovery({ providerHasKey: false }) }));

      expect(component.aiHasKey('discoveryLead')).toBeFalse();
      const root = open(fixture, 'discoveryLead');
      expect(root.textContent).toContain('No Claude key is saved yet');
      const link = root.querySelector('a[href="/settings/ai-providers"]');
      expect(link?.textContent).toContain('Configuration > AI Providers');
    });

    it('tests the conversation tool under the Conversation feature name', () => {
      const { component } = create(stored());

      component.testAi('conversation');

      expect(service.testAiFeature).toHaveBeenCalledWith('Conversation', { settings: { mode: 'Api', provider: 'OpenAI' } });
    });

    it('tests the tool on screen and clears the outcome when the choice changes', () => {
      const { component } = create(stored());

      component.testAi('discoveryLead');

      expect(service.testAiFeature).toHaveBeenCalledWith('DiscoveryLead', { settings: { mode: 'Api', provider: 'Anthropic' } });
      expect(component.aiResults.discoveryLead?.message).toBe('ChatGPT answered');

      component.aiForm.controls.discoveryLead.controls.mode.setValue('Simulator');
      expect(component.aiResults.discoveryLead).toBeNull();
    });

    it('has a Discovery lead - AI suggest panel, separate from the discovery agent, offering all three tools', () => {
      const { component } = create(stored());

      expect(component.aiFeatures.find((f) => f.key === 'discoveryKeywords')?.title).toBe('Discovery lead - AI suggest');
      expect(component.toolsFor('discoveryKeywords').map((t) => t.label)).toEqual(['ChatGPT', 'Claude', 'Gemini']);
      expect(component.toolsFor('discoveryLead').map((t) => t.label)).toEqual(['Claude']);

      component.aiForm.controls.discoveryKeywords.controls.mode.setValue('Simulator');
      component.aiForm.markAsDirty();
      component.save();
      expect(service.saveAiFeatures.calls.mostRecent().args[0].discoveryKeywords.mode).toBe('Simulator');
    });

    it('shows one panel per product-knowledge task group, each with Off, the simulator and all three tools', () => {
      const { fixture, component } = create(stored());
      const root = open(fixture, 'productSuggestedAnswers');

      expect(component.productTaskFeatures.map((f) => f.title)).toEqual([
        'Reading documents and PDFs', 'Reading scanned pages and images', 'Suggested answers', 'Questionnaire and benefits',
        'Gaps and conflicts check', 'Draft knowledge file',
      ]);
      expect(labels(root, 'Suggested answers runs on')).toEqual(['Off', 'Simulator', 'ChatGPT', 'Claude', 'Gemini']);
      expect(component.toolsFor('productSuggestedAnswers').map((t) => t.label)).toEqual(['ChatGPT', 'Claude', 'Gemini']);

      // The saved state arrives as a list and lands on each panel: scanned pages start Off.
      expect(component.aiForm.controls.productScannedReading.controls.mode.value).toBe('Off');
      expect(open(fixture, 'productScannedReading').querySelector('[data-testid="off-note"]')?.textContent).toContain('nothing is sent anywhere');
      expect(component.aiForm.controls.productSuggestedAnswers.controls.mode.value).toBe('Simulator');

      // Off is only offered for product knowledge.
      expect(labels(open(fixture, 'businessKeywords'), 'Profile Information - Keyword AI Suggest runs on')).not.toContain('Off');
    });

    it('saves each task group on its own switch', () => {
      const { component } = create(stored());

      component.aiForm.controls.productSuggestedAnswers.controls.mode.setValue('Api');
      component.aiForm.controls.productSuggestedAnswers.controls.provider.setValue('Anthropic');
      component.aiForm.controls.productDocumentReading.controls.mode.setValue('Off');
      component.aiForm.markAsDirty();
      component.save();

      const sent = service.saveAiFeatures.calls.mostRecent().args[0].productKnowledgeTasks;
      expect(sent.length).toBe(6);
      expect(sent.find((g) => g.feature === 'ProductSuggestedAnswers')).toEqual({ feature: 'ProductSuggestedAnswers', mode: 'Api', provider: 'Anthropic' });
      expect(sent.find((g) => g.feature === 'ProductDocumentReading')?.mode).toBe('Off');
      expect(sent.find((g) => g.feature === 'ProductScannedReading')?.mode).toBe('Off');
      expect(sent.find((g) => g.feature === 'ProductKnowledgeDraft')?.mode).toBe('Simulator');
    });

    it('tests a task group with its own feature name', () => {
      const { component } = create(stored());
      component.aiForm.controls.productGapCheck.controls.mode.setValue('Api');

      component.testAi('productGapCheck');

      expect(service.testAiFeature).toHaveBeenCalledWith('ProductGapCheck', { settings: { mode: 'Api', provider: 'OpenAI' } });
    });

    it('says so when the saved tool is switched off under AI Providers, and keeps the choice', () => {
      const { component } = create(stored(), aiStored({ discoveryKeywords: aiChannel({
        mode: 'Api', provider: 'OpenAI', providerHasKey: false, providerEnabled: false, supportedProviders: ['Anthropic', 'OpenAI', 'Google'],
      }) }));

      expect(component.aiToolOff('discoveryKeywords')).toBeTrue();
      expect(component.aiForm.controls.discoveryKeywords.controls.mode.value).toBe('Api');
      expect(component.aiForm.controls.discoveryKeywords.controls.provider.value).toBe('OpenAI');

      component.aiForm.controls.discoveryKeywords.controls.provider.setValue('Anthropic');
      expect(component.aiToolOff('discoveryKeywords')).toBeFalse();
    });

    it('has a Profile Information - Keyword AI Suggest panel offering all three tools, saved and tested like the others', () => {
      const { component } = create(stored());

      expect(component.aiFeatures.find((f) => f.key === 'businessKeywords')?.title).toBe('Profile Information - Keyword AI Suggest');
      expect(component.toolsFor('businessKeywords').map((t) => t.label)).toEqual(['ChatGPT', 'Claude', 'Gemini']);

      component.aiForm.controls.businessKeywords.controls.provider.setValue('Google');
      component.aiForm.markAsDirty();

      component.testAi('businessKeywords');
      expect(service.testAiFeature).toHaveBeenCalledWith('BusinessKeywords', { settings: { mode: 'Api', provider: 'Google' } });

      component.save();
      expect(service.saveAiFeatures.calls.mostRecent().args[0].businessKeywords).toEqual({ mode: 'Api', provider: 'Google' });
    });
  });
});
