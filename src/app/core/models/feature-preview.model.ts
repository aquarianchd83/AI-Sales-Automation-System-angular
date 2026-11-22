import { PLATFORM_FEATURES, PLATFORM_FEATURE_ICONS, PLATFORM_FEATURE_LABELS, PlatformFeature } from './wallet.model';

/** One picture on a feature's preview page. Until real screenshots exist it renders as an icon placeholder with its caption. */
export interface FeaturePreviewImage {
  icon: string;
  caption: string;
}

/**
 * What a tenant sees about a feature their plan lacks: the preview page (Premium preview) and the dashboard's "Unlock more" card both read it.
 * Credit costs are not part of it on purpose: they come from the platform's own prices (the wallet), never from copy.
 */
export interface FeaturePreview {
  feature: PlatformFeature;
  /** The URL segment: /premium/<slug>. */
  slug: string;
  title: string;
  icon: string;
  /** One line on what the tenant gets. */
  outcome: string;
  /** Exactly three. */
  benefits: [string, string, string];
  /** Exactly three. */
  images: [FeaturePreviewImage, FeaturePreviewImage, FeaturePreviewImage];
}

export const FEATURE_PREVIEWS: Record<PlatformFeature, FeaturePreview> = {
  WhatsAppMessaging: {
    feature: 'WhatsAppMessaging',
    slug: 'whatsapp-messaging',
    title: PLATFORM_FEATURE_LABELS.WhatsAppMessaging,
    icon: PLATFORM_FEATURE_ICONS.WhatsAppMessaging,
    outcome: 'Reach your customers on WhatsApp with templates and campaigns.',
    benefits: [
      'Message a whole customer list in one campaign',
      'Write a template once and reuse it in every chat and campaign',
      'Plan a sequence of messages that goes out on its own',
    ],
    images: [
      { icon: 'campaign', caption: 'Campaign builder' },
      { icon: 'text_snippet', caption: 'Message templates' },
      { icon: 'schedule_send', caption: 'Message sequence' },
    ],
  },
  AiConversations: {
    feature: 'AiConversations',
    slug: 'ai-conversations',
    title: PLATFORM_FEATURE_LABELS.AiConversations,
    icon: PLATFORM_FEATURE_ICONS.AiConversations,
    outcome: 'Let the AI answer your customers on WhatsApp, day and night.',
    benefits: [
      'Answer customer questions in seconds, at any hour',
      'Book demos and visits the customer agrees to in the chat',
      'Hand a chat to your team when the customer asks for a person',
    ],
    images: [
      { icon: 'forum', caption: 'AI replies in the inbox' },
      { icon: 'event_available', caption: 'Demos booked in chat' },
      { icon: 'support_agent', caption: 'Handoff to your team' },
    ],
  },
  LeadDiscovery: {
    feature: 'LeadDiscovery',
    slug: 'lead-discovery',
    title: PLATFORM_FEATURE_LABELS.LeadDiscovery,
    icon: PLATFORM_FEATURE_ICONS.LeadDiscovery,
    outcome: 'Find new businesses that match the customers you sell to.',
    benefits: [
      'Describe your ideal customer once and get matching leads',
      'Review each lead before you reach out',
      'See every discovery run and its results in one history',
    ],
    images: [
      { icon: 'person_search', caption: 'Ideal customer profile' },
      { icon: 'travel_explore', caption: 'Discovered leads' },
      { icon: 'history', caption: 'Discovery history' },
    ],
  },
  ContentStudio: {
    feature: 'ContentStudio',
    slug: 'content-studio',
    title: PLATFORM_FEATURE_LABELS.ContentStudio,
    icon: PLATFORM_FEATURE_ICONS.ContentStudio,
    outcome: 'Turn what you know about your business into marketing stories and videos.',
    benefits: [
      'Answer a short questionnaire about your business',
      'Get stories and videos written from your own answers',
      'Track every story and what it cost in one place',
    ],
    images: [
      { icon: 'quiz', caption: 'Business questionnaire' },
      { icon: 'movie_creation', caption: 'Story Studio' },
      { icon: 'receipt_long', caption: 'Charges and activity' },
    ],
  },
  ProductKnowledge: {
    feature: 'ProductKnowledge',
    slug: 'product-knowledge',
    title: PLATFORM_FEATURE_LABELS.ProductKnowledge,
    icon: PLATFORM_FEATURE_ICONS.ProductKnowledge,
    outcome: 'Teach the AI your products and prices so its answers are right.',
    benefits: [
      'Add your documents or website as sources',
      'Approve the answers before the AI uses them',
      'Publish a version and test it in a practice chat',
    ],
    images: [
      { icon: 'source', caption: 'Knowledge sources' },
      { icon: 'fact_check', caption: 'Approved answers' },
      { icon: 'chat', caption: 'Test chat' },
    ],
  },
};

/** Where the preview of a feature lives, as router commands: ['/premium', '<slug>']. */
export function featurePreviewCommands(feature: PlatformFeature): string[] {
  return ['/premium', FEATURE_PREVIEWS[feature].slug];
}

/** Where the preview of a feature lives, as a URL. */
export function featurePreviewUrl(feature: PlatformFeature): string {
  return featurePreviewCommands(feature).join('/');
}

/** The feature a preview URL segment names, or null for an unknown one. */
export function featureFromSlug(slug: string | null | undefined): PlatformFeature | null {
  return PLATFORM_FEATURES.find((f) => FEATURE_PREVIEWS[f].slug === slug) ?? null;
}
