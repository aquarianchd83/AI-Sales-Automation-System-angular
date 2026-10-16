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
      declarations: [PlatformIntegrationSettingsComponent],
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

  it('starts on the simulator for both services and shows no API fields', () => {
    const { fixture, component } = create(stored());

    expect(component.isApi('consentSms')).toBeFalse();
    expect(component.isApi('dndCheck')).toBeFalse();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Consent SMS');
    expect(text).toContain('DND check');
    expect(text).toContain('nothing leaves the platform');
    expect((fixture.nativeElement as HTMLElement).querySelector('input[formcontrolname="apiUrl"]')).toBeNull();
  });

  it('shows the API fields for a service switched to the third-party API, and the key only as a hint', () => {
    const { fixture, component } = create(
      stored({ consentSms: channel({ mode: 'Api', apiUrl: 'https://sms.example.com/send', hasApiKey: true, apiKeyHint: '••••1234', isLive: true }) })
    );

    expect(component.isApi('consentSms')).toBeTrue();
    expect(component.isApi('dndCheck')).toBeFalse();
    expect(component.form.controls.consentSms.controls.apiKey.value).toBe('');
    expect(component.storedHint('consentSms')).toBe('••••1234');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input[formcontrolname="apiUrl"]').length).toBe(1);
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
    const labels = (root: HTMLElement, group: string) =>
      Array.from(root.querySelectorAll(`mat-radio-group[aria-label="${group}"] mat-radio-button`)).map((e) => e.textContent?.trim());

    it('shows a panel for each AI feature and says availability depends on the feature', () => {
      const { fixture } = create(stored());

      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      for (const title of ['AI conversation', 'Discovery lead', 'Knowledge base', 'Content generation', 'Video renders']) {
        expect(text).toContain(title);
      }
      expect(text).toContain('AI provider availability depends on the selected feature');
    });

    it('offers Claude only for discovery lead, whatever other keys exist', () => {
      const { fixture, component } = create(stored());

      expect(component.toolsFor('discoveryLead').map((t) => t.label)).toEqual(['Claude']);
      expect(labels(fixture.nativeElement, 'Discovery lead tool')).toEqual(['Claude']);
    });

    it('offers ChatGPT, Claude and Gemini for the conversation and ChatGPT and Gemini for embeddings', () => {
      const { fixture, component } = create(stored());

      expect(component.conversationTools.map((t) => t.label)).toEqual(['ChatGPT', 'Claude', 'Gemini']);
      expect(component.embeddingTools.map((t) => t.label)).toEqual(['ChatGPT', 'Gemini']);
      expect(labels(fixture.nativeElement, 'AI conversation tool')).toEqual(['ChatGPT', 'Claude', 'Gemini']);
      expect(labels(fixture.nativeElement, 'Embeddings tool')).toEqual(['ChatGPT', 'Gemini']);
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
      const root = fixture.nativeElement as HTMLElement;
      expect(root.textContent).toContain('does not use a third-party tool today');
      fixture.detectChanges();
      const radios = Array.from(root.querySelectorAll('mat-radio-group[aria-label="Knowledge base handling"] input[type="radio"]')) as HTMLInputElement[];
      expect(radios[1].disabled).toBeTrue();
      expect(radios[0].disabled).toBeFalse();
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
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('The tool saved earlier (ChatGPT) is not available for this feature');
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

      expect((fixture.nativeElement as HTMLElement).textContent).toContain('AI conversation');
      expect(component.isConversationThirdParty()).toBeTrue();
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
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('No Claude key is saved yet');
      const link = (fixture.nativeElement as HTMLElement).querySelector('a[href="/settings/ai-providers"]');
      expect(link?.textContent).toContain('Configuration > AI Providers');
      expect(link?.getAttribute('target')).toBe('_blank');
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
  });
});
