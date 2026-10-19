import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { forkJoin, Observable, of } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  AiConversationChannel,
  AiFeatureChannel,
  AiFeatureMode,
  AiToolProvider,
  DeliveryTestResult,
  IntegrationChannel,
  IntegrationChannelRequest,
  IntegrationMode,
  PlatformAiFeatureSettings,
  PlatformIntegrationSettings,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformIntegrationSettingsService } from '../../../core/services/platform-integration-settings.service';

export type IntegrationChannelKey = 'consentSms' | 'dndCheck';
/** The feature panels; the conversation panel has its own shape (a chat tool and an embedding tool). */
export type AiFeatureKey =
  | 'discoveryLead'
  | 'knowledgeBase'
  | 'contentGeneration'
  | 'videoRenders'
  | 'businessKeywords'
  | 'discoveryKeywords'
  | ProductTaskKey;

/** The product-knowledge task groups: each is Off, the simulator, or ChatGPT, Claude or Gemini on its own. */
export type ProductTaskKey =
  | 'productDocumentReading'
  | 'productScannedReading'
  | 'productSuggestedAnswers'
  | 'productQuestionnaire'
  | 'productGapCheck'
  | 'productKnowledgeDraft';

interface AiFeaturePanel {
  key: AiFeatureKey;
  apiName: string;
  title: string;
  description: string;
  simulatorNote: string;
  /** Product-knowledge task groups can be switched Off. */
  allowOff?: boolean;
}

const PRODUCT_SIMULATOR_NOTE = 'Fixed, labelled test data is returned. No document is read, no provider is contacted, and nothing it returns can be published as verified.';

const product = (key: ProductTaskKey, apiName: string, title: string, description: string): AiFeaturePanel => ({
  key,
  apiName,
  title,
  description,
  simulatorNote: PRODUCT_SIMULATOR_NOTE,
  allowOff: true,
});

const ALL_AI_KEYS: AiFeatureKey[] = [
  'discoveryLead',
  'knowledgeBase',
  'contentGeneration',
  'videoRenders',
  'businessKeywords',
  'discoveryKeywords',
  'productDocumentReading',
  'productScannedReading',
  'productSuggestedAnswers',
  'productQuestionnaire',
  'productGapCheck',
  'productKnowledgeDraft',
];

function flags<T>(value: T): Record<AiFeatureKey | 'conversation', T> {
  return Object.fromEntries([...ALL_AI_KEYS, 'conversation'].map((k) => [k, value])) as Record<AiFeatureKey | 'conversation', T>;
}

/**
 * The Platform Admin Console's Integrations page: for each outside service - the WhatsApp consent SMS and the DND check - whether it is
 * handled by the built-in simulator (nothing leaves the platform) or by a third-party API. Saved to the database only, the API keys
 * encrypted at rest and never shown again: a blank key field keeps the stored one, and "Remove" clears it. The test buttons make one real
 * call with what is on screen, saved or not.
 *
 * Below those, one panel per AI feature (discovery leads, knowledge base, content generation, video renders): the simulator, or a
 * third-party tool - ChatGPT, Claude or Gemini - using the key saved under Configuration > AI Providers, so no key is typed here.
 */
@Component({
  selector: 'app-platform-integration-settings',
  templateUrl: './platform-integration-settings.component.html',
  styleUrls: ['./platform-integration-settings.component.scss'],
})
export class PlatformIntegrationSettingsComponent implements OnInit {
  readonly channels: { key: IntegrationChannelKey; title: string; description: string; testLabel: string; testIcon: string }[] = [
    {
      key: 'consentSms',
      title: 'Consent SMS',
      description: 'The SMS that invites a discovered customer to start a WhatsApp conversation.',
      testLabel: 'Send test SMS',
      testIcon: 'sms',
    },
    {
      key: 'dndCheck',
      title: 'DND check',
      description: 'Checks whether a discovered mobile number may be contacted (Do Not Disturb and similar restrictions).',
      testLabel: 'Check this number',
      testIcon: 'verified_user',
    },
  ];

  readonly aiFeatures: AiFeaturePanel[] = [
    {
      key: 'discoveryLead',
      apiName: 'DiscoveryLead',
      title: 'Discovery lead',
      description: 'The discovery agent that runs the searches and finds new customers. Only Claude can do this.',
      simulatorNote: 'Sample businesses are produced instead of searching the web.',
    },
    {
      key: 'knowledgeBase',
      apiName: 'KnowledgeBase',
      title: 'Knowledge base',
      description: 'The AI work behind the knowledge base: understanding articles and answering from them.',
      simulatorNote: 'Answers are simple keyword matches, good for trying things out.',
    },
    {
      key: 'contentGeneration',
      apiName: 'ContentGeneration',
      title: 'Content generation',
      description: 'Writes the scripts, captions and copy for the AI Content Studio.',
      simulatorNote: 'Placeholder text is produced and no AI credit is spent.',
    },
    {
      key: 'videoRenders',
      apiName: 'VideoRenders',
      title: 'Video renders',
      description: 'Plans and renders the marketing videos for the AI Content Studio.',
      simulatorNote: 'A sample video is produced and no render is billed.',
    },
    {
      key: 'discoveryKeywords',
      apiName: 'DiscoveryKeywords',
      title: 'Discovery lead - AI suggest',
      description: 'The AI suggest button on the lead discovery profile (Who to find): suggests the search words used to find new customers.',
      simulatorNote: 'The built-in common terms for the target business type are suggested instead.',
    },
    {
      key: 'businessKeywords',
      apiName: 'BusinessKeywords',
      title: 'Profile Information - Keyword AI Suggest',
      description: 'The AI suggest button on the Profile Information screen (and onboarding): suggests the products, services and topics a business deals in.',
      simulatorNote: 'The built-in common terms for the industry the tenant chose are suggested instead.',
    },
  ];

  /**
   * Product knowledge, one panel per group of tasks, so each can be switched Off or moved to another tool on its own. The titles match the
   * server's (AiFeatures.ProductTaskGroups), which also names them on the AI Providers screen.
   */
  readonly productTaskFeatures: AiFeaturePanel[] = [
    product('productDocumentReading', 'ProductDocumentReading', 'Reading documents and PDFs',
      'Reads the text of uploaded documents and PDFs and pulls out product facts: names, prices, features, terms.'),
    product('productScannedReading', 'ProductScannedReading', 'Reading scanned pages and images',
      'Reads scanned PDFs and photos of documents. The page images are sent to the chosen tool, so this starts Off. Needs a model that accepts images.'),
    product('productSuggestedAnswers', 'ProductSuggestedAnswers', 'Suggested answers',
      "Drafts answers to the onboarding questions and to the tenant's own questions, from the tenant's sources only."),
    product('productQuestionnaire', 'ProductQuestionnaire', 'Questionnaire and benefits',
      'Builds the questions to ask for an industry and writes the benefits and customer value of a product.'),
    product('productGapCheck', 'ProductGapCheck', 'Gaps and conflicts check',
      'Finds missing information, sources that disagree, and merges repeated facts into one.'),
    product('productKnowledgeDraft', 'ProductKnowledgeDraft', 'Draft knowledge file',
      'Writes the draft knowledge file the AI chat answers from, for the tenant to review before it is used.'),
  ];

  /** The tools on offer, by the name people know them under. */
  readonly aiTools: { value: AiToolProvider; label: string }[] = [
    { value: 'OpenAI', label: 'ChatGPT' },
    { value: 'Anthropic', label: 'Claude' },
    { value: 'Google', label: 'Gemini' },
  ];

  readonly aiForm = this.fb.group({
    conversation: this.fb.group({
      mode: this.fb.control<IntegrationMode>('Simulator'),
      provider: this.fb.control<AiToolProvider>('OpenAI'),
      embeddingMode: this.fb.control<IntegrationMode>('Simulator'),
      embeddingProvider: this.fb.control<AiToolProvider>('OpenAI'),
    }),
    discoveryLead: this.aiGroup(),
    knowledgeBase: this.aiGroup(),
    contentGeneration: this.aiGroup(),
    videoRenders: this.aiGroup(),
    businessKeywords: this.aiGroup(),
    discoveryKeywords: this.aiGroup(),
    productDocumentReading: this.aiGroup(),
    productScannedReading: this.aiGroup(),
    productSuggestedAnswers: this.aiGroup(),
    productQuestionnaire: this.aiGroup(),
    productGapCheck: this.aiGroup(),
    productKnowledgeDraft: this.aiGroup(),
  });

  readonly form = this.fb.group({
    consentSms: this.channelGroup(),
    dndCheck: this.channelGroup(),
  });

  /** Where the test calls go. Not part of the settings, so outside the form (and its "unsaved changes" state). */
  readonly testTo = {
    consentSms: this.fb.control('', [Validators.pattern(/^\+[0-9 ()-]{8,20}$/)]),
    dndCheck: this.fb.control('', [Validators.pattern(/^\+[0-9 ()-]{8,20}$/)]),
  };

  current: PlatformIntegrationSettings | null = null;
  currentAi: PlatformAiFeatureSettings | null = null;
  aiTesting = flags<boolean>(false);
  aiResults = flags<DeliveryTestResult | null>(null);
  loading = true;
  loadFailed = false;
  saving = false;
  testing: Record<IntegrationChannelKey, boolean> = { consentSms: false, dndCheck: false };
  /** Outcomes of the last tests; cleared as soon as the form changes, since they no longer describe what is on screen. */
  results: Record<IntegrationChannelKey, DeliveryTestResult | null> = { consentSms: null, dndCheck: null };

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly integrations: PlatformIntegrationSettingsService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
    this.form.valueChanges.subscribe(() => (this.results = { consentSms: null, dndCheck: null }));
    this.aiForm.valueChanges.subscribe(() => (this.aiResults = flags<DeliveryTestResult | null>(null)));

    // Switching a feature to a third-party tool picks one it supports, so a leftover tool it cannot run on is never submitted.
    for (const feature of [...this.aiFeatures, ...this.productTaskFeatures]) {
      const group = this.aiForm.controls[feature.key].controls;
      group.mode.valueChanges.subscribe((mode) => {
        const supported = this.channel(feature.key)?.supportedProviders ?? [];
        if (mode === 'Api' && supported.length > 0 && !supported.includes(group.provider.value)) {
          group.provider.setValue(supported[0]);
        }
      });
    }
  }

  /** Something on either form is waiting to be saved. */
  get dirty(): boolean {
    return this.form.dirty || this.aiForm.dirty;
  }

  isAiThirdParty(key: AiFeatureKey): boolean {
    return this.aiForm.controls[key].controls.mode.value === 'Api';
  }

  /** The name of the tool picked on a panel. Typed helpers for the shared panel template, whose context is untyped. */
  pickedToolLabel(key: AiFeatureKey): string {
    return this.aiToolLabel(this.aiForm.controls[key].controls.provider.value);
  }

  isTesting(key: AiFeatureKey): boolean {
    return this.aiTesting[key];
  }

  resultOf(key: AiFeatureKey): DeliveryTestResult | null {
    return this.aiResults[key];
  }

  isAiOff(key: AiFeatureKey): boolean {
    return this.aiForm.controls[key].controls.mode.value === 'Off';
  }

  /** What the server says about a feature's saved choice. Product-knowledge task groups arrive as a list, the rest by name. */
  channel(key: AiFeatureKey): AiFeatureChannel | undefined {
    const panel = this.productTaskFeatures.find((f) => f.key === key);
    if (panel) {
      return this.currentAi?.productKnowledgeTasks?.find((g) => g.feature === panel.apiName)?.channel;
    }
    return this.currentAi?.[key as Exclude<AiFeatureKey, ProductTaskKey>];
  }

  aiToolLabel(provider: AiToolProvider): string {
    return this.aiTools.find((t) => t.value === provider)?.label ?? provider;
  }

  isConversationThirdParty(): boolean {
    return this.aiForm.controls.conversation.controls.mode.value === 'Api';
  }

  isEmbeddingThirdParty(): boolean {
    return this.aiForm.controls.conversation.controls.embeddingMode.value === 'Api';
  }

  /** The tools a feature really supports, as the server says - the page never offers more than that. */
  toolsFor(key: AiFeatureKey): { value: AiToolProvider; label: string }[] {
    const supported = this.channel(key)?.supportedProviders ?? [];
    return this.aiTools.filter((t) => supported.includes(t.value));
  }

  /** True when the feature uses no third-party tool yet, so only the simulator can be chosen. */
  noToolYet(key: AiFeatureKey): boolean {
    const channel = this.channel(key);
    return !!channel && channel.supportedProviders.length === 0;
  }

  /** A tool saved earlier that the feature cannot run on: kept as saved, not used. */
  savedToolUnsupported(key: AiFeatureKey): boolean {
    const channel = this.channel(key);
    return !!channel && !channel.savedProviderSupported;
  }

  get conversationTools(): { value: AiToolProvider; label: string }[] {
    const supported = this.currentAi?.conversation.supportedProviders ?? [];
    return this.aiTools.filter((t) => supported.includes(t.value));
  }

  /** Embeddings: the server lists ChatGPT and Gemini - Claude has no embeddings endpoint. */
  get embeddingTools(): { value: AiToolProvider; label: string }[] {
    const supported = this.currentAi?.conversation.supportedEmbeddingProviders ?? [];
    return this.aiTools.filter((t) => supported.includes(t.value));
  }

  /** Whether a key is saved for the chat tool (or, with `embedding`, the embedding tool) picked on the conversation panel. */
  conversationHasKey(embedding = false): boolean {
    const form = this.aiForm.controls.conversation.controls;
    const saved: AiConversationChannel | undefined = this.currentAi?.conversation;
    const provider = embedding ? form.embeddingProvider.value : form.provider.value;
    const savedProvider = embedding ? saved?.embeddingProvider : saved?.provider;
    const savedKey = embedding ? saved?.embeddingProviderHasKey : saved?.providerHasKey;
    return !saved || savedProvider !== provider || !!savedKey;
  }

  /** The tool picked on a panel is switched Off under AI Providers: its choice is kept, but the simulator answers. */
  aiToolOff(key: AiFeatureKey): boolean {
    const provider = this.aiForm.controls[key].controls.provider.value;
    const saved: AiFeatureChannel | undefined = this.channel(key);
    return !!saved && saved.provider === provider && saved.providerEnabled === false;
  }

  /** Whether a key is saved for the tool picked on a panel. */
  aiHasKey(key: AiFeatureKey): boolean {
    const provider = this.aiForm.controls[key].controls.provider.value;
    const saved: AiFeatureChannel | undefined = this.channel(key);
    // The server reports the key of the saved choice; for another pick it is only known on save, so assume yes until it says otherwise.
    return !saved || saved.provider !== provider || saved.providerHasKey;
  }

  isApi(key: IntegrationChannelKey): boolean {
    return this.form.controls[key].controls.mode.value === 'Api';
  }

  removingKey(key: IntegrationChannelKey): boolean {
    return this.form.controls[key].controls.removeApiKey.value;
  }

  /** The last four characters of a stored key, never the value. */
  storedHint(key: IntegrationChannelKey): string | null {
    const channel = this.current?.[key];
    return channel?.hasApiKey ? channel.apiKeyHint ?? 'set' : null;
  }

  hasStoredKey(key: IntegrationChannelKey): boolean {
    return !!this.current?.[key].hasApiKey;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    forkJoin({ channels: this.integrations.get(), ai: this.integrations.getAiFeatures() })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ channels, ai }) => {
          this.apply(channels);
          this.applyAi(ai);
        },
        error: () => (this.loadFailed = true),
      });
  }

  save(): void {
    if (this.saving || !this.dirty) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    // Only what changed is sent, so a form that was not touched is never re-saved.
    const channels$: Observable<PlatformIntegrationSettings | null> = this.form.dirty
      ? this.integrations.save({ consentSms: this.buildRequest('consentSms'), dndCheck: this.buildRequest('dndCheck') })
      : of(null);
    const ai$: Observable<PlatformAiFeatureSettings | null> = this.aiForm.dirty
      ? this.integrations.saveAiFeatures(this.buildAiRequest())
      : of(null);

    this.saving = true;
    forkJoin({ channels: channels$, ai: ai$ })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: ({ channels, ai }) => {
          this.notify.success('Integration settings saved. They apply from the next request - no restart needed.');
          if (channels) {
            this.apply(channels);
          }
          if (ai) {
            this.applyAi(ai);
          }
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Asks the tool picked on a panel one trivial question with the saved key, saved choice or not. */
  testAi(key: AiFeatureKey | 'conversation'): void {
    if (this.aiTesting[key]) {
      return;
    }
    const apiName = key === 'conversation' ? 'Conversation' : [...this.aiFeatures, ...this.productTaskFeatures].find((f) => f.key === key)!.apiName;
    const settings =
      key === 'conversation'
        ? { mode: this.aiForm.controls.conversation.controls.mode.value, provider: this.aiForm.controls.conversation.controls.provider.value }
        : this.aiChannelRequest(key);
    this.aiTesting[key] = true;
    this.aiResults[key] = null;
    this.integrations
      .testAiFeature(apiName, { settings })
      .pipe(finalize(() => (this.aiTesting[key] = false)))
      .subscribe({
        next: (result) => (this.aiResults[key] = result),
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Makes one real call with what is on screen. A blank key field tests with the stored key. */
  test(key: IntegrationChannelKey): void {
    const control = this.testTo[key];
    const to = control.value.trim();
    if (this.testing[key] || !to || control.invalid) {
      control.markAsTouched();
      return;
    }

    this.testing[key] = true;
    this.results[key] = null;
    const request = { settings: this.buildRequest(key), to };
    const call = key === 'consentSms' ? this.integrations.testConsentSms(request) : this.integrations.testDndCheck(request);
    call.pipe(finalize(() => (this.testing[key] = false))).subscribe({
      next: (result) => (this.results[key] = result),
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  private aiGroup() {
    return this.fb.group({
      mode: this.fb.control<AiFeatureMode>('Simulator'),
      provider: this.fb.control<AiToolProvider>('OpenAI'),
    });
  }

  private aiChannelRequest(key: AiFeatureKey) {
    const raw = this.aiForm.controls[key].getRawValue();
    return { mode: raw.mode, provider: raw.provider };
  }

  private buildAiRequest() {
    return {
      conversation: this.aiForm.controls.conversation.getRawValue(),
      discoveryLead: this.aiChannelRequest('discoveryLead'),
      knowledgeBase: this.aiChannelRequest('knowledgeBase'),
      contentGeneration: this.aiChannelRequest('contentGeneration'),
      videoRenders: this.aiChannelRequest('videoRenders'),
      businessKeywords: this.aiChannelRequest('businessKeywords'),
      discoveryKeywords: this.aiChannelRequest('discoveryKeywords'),
      productKnowledgeTasks: this.productTaskFeatures.map((f) => ({ feature: f.apiName, ...this.aiChannelRequest(f.key) })),
    };
  }

  private applyAi(settings: PlatformAiFeatureSettings): void {
    this.currentAi = settings;
    const values = (c: AiFeatureChannel | undefined) => ({ mode: c?.mode ?? 'Simulator', provider: c?.provider ?? 'OpenAI' });
    const task = (key: ProductTaskKey) => values(this.channel(key));
    this.aiForm.reset({
      conversation: {
        mode: settings.conversation.mode,
        provider: settings.conversation.provider,
        embeddingMode: settings.conversation.embeddingMode,
        embeddingProvider: settings.conversation.embeddingProvider,
      },
      discoveryLead: values(settings.discoveryLead),
      knowledgeBase: values(settings.knowledgeBase),
      contentGeneration: values(settings.contentGeneration),
      videoRenders: values(settings.videoRenders),
      businessKeywords: values(settings.businessKeywords),
      discoveryKeywords: values(settings.discoveryKeywords),
      productDocumentReading: task('productDocumentReading'),
      productScannedReading: task('productScannedReading'),
      productSuggestedAnswers: task('productSuggestedAnswers'),
      productQuestionnaire: task('productQuestionnaire'),
      productGapCheck: task('productGapCheck'),
      productKnowledgeDraft: task('productKnowledgeDraft'),
    });
  }

  private channelGroup() {
    return this.fb.group({
      mode: this.fb.control<IntegrationMode>('Simulator'),
      apiUrl: ['', [Validators.pattern(/^https:\/\/\S+$/i)]],
      apiKeyHeader: ['Authorization', [Validators.pattern(/^[A-Za-z0-9_-]*$/)]],
      senderId: '',
      timeoutSeconds: [15, [Validators.required, Validators.min(1), Validators.max(120)]],
      apiKey: '',
      removeApiKey: false,
    });
  }

  /** What one channel's form means as a request. Key: blank = null = keep what is stored; "Remove" = '' = clear it. */
  private buildRequest(key: IntegrationChannelKey): IntegrationChannelRequest {
    const raw = this.form.controls[key].getRawValue();
    return {
      mode: raw.mode,
      apiUrl: raw.apiUrl.trim(),
      apiKey: raw.removeApiKey ? '' : raw.apiKey.trim() || null,
      apiKeyHeader: raw.apiKeyHeader.trim() || 'Authorization',
      senderId: raw.senderId.trim(),
      timeoutSeconds: Number(raw.timeoutSeconds),
    };
  }

  private apply(settings: PlatformIntegrationSettings): void {
    this.current = settings;
    const values = (channel: IntegrationChannel) => ({
      mode: channel.mode,
      apiUrl: channel.apiUrl,
      apiKeyHeader: channel.apiKeyHeader,
      senderId: channel.senderId,
      timeoutSeconds: channel.timeoutSeconds,
      apiKey: '',
      removeApiKey: false,
    });
    this.form.reset({ consentSms: values(settings.consentSms), dndCheck: values(settings.dndCheck) });
  }
}
