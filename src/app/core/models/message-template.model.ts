export enum TemplateCategory {
  Marketing = 'Marketing',
  Utility = 'Utility',
  Authentication = 'Authentication',
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  TemplateCategory.Marketing,
  TemplateCategory.Utility,
  TemplateCategory.Authentication,
];

export interface TemplateLanguageOption {
  code: string;
  label: string;
}

/**
 * The language codes Meta accepts for WhatsApp message templates, sorted by label. A template's
 * language must be one of these for Meta to accept the submission.
 */
export const TEMPLATE_LANGUAGES: TemplateLanguageOption[] = [
  { code: 'af', label: 'Afrikaans' },
  { code: 'sq', label: 'Albanian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'az', label: 'Azerbaijani' },
  { code: 'bn', label: 'Bengali' },
  { code: 'bg', label: 'Bulgarian' },
  { code: 'ca', label: 'Catalan' },
  { code: 'zh_CN', label: 'Chinese (China)' },
  { code: 'zh_HK', label: 'Chinese (Hong Kong)' },
  { code: 'zh_TW', label: 'Chinese (Taiwan)' },
  { code: 'hr', label: 'Croatian' },
  { code: 'cs', label: 'Czech' },
  { code: 'da', label: 'Danish' },
  { code: 'nl', label: 'Dutch' },
  { code: 'en', label: 'English' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'et', label: 'Estonian' },
  { code: 'fil', label: 'Filipino' },
  { code: 'fi', label: 'Finnish' },
  { code: 'fr', label: 'French' },
  { code: 'ka', label: 'Georgian' },
  { code: 'de', label: 'German' },
  { code: 'el', label: 'Greek' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ha', label: 'Hausa' },
  { code: 'he', label: 'Hebrew' },
  { code: 'hi', label: 'Hindi' },
  { code: 'hu', label: 'Hungarian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ga', label: 'Irish' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'kn', label: 'Kannada' },
  { code: 'kk', label: 'Kazakh' },
  { code: 'rw_RW', label: 'Kinyarwanda' },
  { code: 'ko', label: 'Korean' },
  { code: 'ky_KG', label: 'Kyrgyz' },
  { code: 'lo', label: 'Lao' },
  { code: 'lv', label: 'Latvian' },
  { code: 'lt', label: 'Lithuanian' },
  { code: 'mk', label: 'Macedonian' },
  { code: 'ms', label: 'Malay' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'mr', label: 'Marathi' },
  { code: 'nb', label: 'Norwegian' },
  { code: 'fa', label: 'Persian' },
  { code: 'pl', label: 'Polish' },
  { code: 'pt_BR', label: 'Portuguese (Brazil)' },
  { code: 'pt_PT', label: 'Portuguese (Portugal)' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ro', label: 'Romanian' },
  { code: 'ru', label: 'Russian' },
  { code: 'sr', label: 'Serbian' },
  { code: 'sk', label: 'Slovak' },
  { code: 'sl', label: 'Slovenian' },
  { code: 'es', label: 'Spanish' },
  { code: 'es_AR', label: 'Spanish (Argentina)' },
  { code: 'es_MX', label: 'Spanish (Mexico)' },
  { code: 'es_ES', label: 'Spanish (Spain)' },
  { code: 'sw', label: 'Swahili' },
  { code: 'sv', label: 'Swedish' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'ur', label: 'Urdu' },
  { code: 'uz', label: 'Uzbek' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'zu', label: 'Zulu' },
];

/**
 * Display label for a template language code. Falls back to the raw code, since templates pulled
 * in by the Meta sync can carry a code this list doesn't know.
 */
export function templateLanguageLabel(code: string): string {
  return TEMPLATE_LANGUAGES.find((l) => l.code.toLowerCase() === code?.toLowerCase())?.label ?? code;
}

export enum WhatsAppTemplateStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

/** MessageTemplateDto. */
export interface MessageTemplate {
  id: string;
  name: string;
  language: string;
  category: TemplateCategory | string;
  whatsAppTemplateName: string;
  whatsAppTemplateStatus: WhatsAppTemplateStatus | string;
  bodyText: string;
  isActive: boolean;
  createdAt: string;
  /** Meta's own template id — null until the template has been created on Meta by a sync. */
  metaTemplateId: string | null;
}

export interface CreateMessageTemplateRequest {
  name: string;
  language: string;
  category: string;
  whatsAppTemplateName: string;
  bodyText: string;
}

/**
 * UpdateMessageTemplateRequest. Language and category are optional and only accepted while the
 * template has not yet been created on Meta (metaTemplateId is null) — the API 409s a change to
 * either after that. Editing the body text, language or category of an Approved template silently
 * reverts it to Pending server-side (a content change that stayed Approved would let an
 * unreviewed message go out under an approved name).
 */
export interface UpdateMessageTemplateRequest {
  bodyText: string;
  isActive: boolean;
  language?: string;
  category?: string;
}

export interface ReviewMessageTemplateRequest {
  status: string;
}

export function templateStatusChipClass(status: string): string {
  switch (status) {
    case WhatsAppTemplateStatus.Approved:
      return 'status-chip status-chip--opted-in';
    case WhatsAppTemplateStatus.Rejected:
      return 'status-chip status-chip--opted-out';
    default:
      return 'status-chip status-chip--pending';
  }
}

/** Everything the UI says about one template category: a one-line intro for lists, and the fuller guide
 * shown on the categories page. Meta assigns and bills by these three; the wording follows Meta's own
 * definitions, kept short and practical. */
export interface TemplateCategoryInfo {
  category: TemplateCategory;
  icon: string;
  /** Chip / accent class suffix, e.g. `marketing`. */
  tone: 'marketing' | 'utility' | 'authentication';
  /** One line, used in the template list and as the category's tooltip. */
  summary: string;
  /** Two or three sentences for the categories page. */
  description: string;
  goodFor: string[];
  examples: string[];
  notFor: string;
  /** How it counts against the tenant's WhatsApp quota, relative to the others. */
  billing: string;
}

export const TEMPLATE_CATEGORY_INFO: Record<TemplateCategory, TemplateCategoryInfo> = {
  [TemplateCategory.Marketing]: {
    category: TemplateCategory.Marketing,
    icon: 'campaign',
    tone: 'marketing',
    summary: 'Promotions, offers and announcements that aim to sell or re-engage.',
    description:
      'The catch-all category: any message that promotes a product, service or brand, or tries to bring a customer back. ' +
      'If a template mixes an update with a sales pitch, Meta treats it as Marketing. Customers must have opted in to receive it.',
    goodFor: ['Discounts and seasonal offers', 'New product or feature announcements', 'Win-back and re-engagement nudges', 'Invitations to events or sales'],
    examples: ['Hi {{FirstName}}, our festive sale is live — 20% off until Sunday!', 'We miss you, {{FirstName}}. Here is an exclusive offer just for you.'],
    notFor: 'Order updates or one-time codes — use Utility or Authentication, which are cheaper and delivered more reliably.',
    billing: 'The highest rate. One send counts as one full quota unit; the other categories use a fraction of that.',
  },
  [TemplateCategory.Utility]: {
    category: TemplateCategory.Utility,
    icon: 'receipt_long',
    tone: 'utility',
    summary: 'Updates about something the customer already asked for or did — orders, bookings, follow-ups.',
    description:
      'Specific, expected messages tied to a customer’s own action or an existing transaction. They must be relevant to that ' +
      'action and must not carry promotional content — adding a sales pitch gets the template reclassified as Marketing.',
    goodFor: ['Order, delivery and payment confirmations', 'Appointment and booking reminders', 'Account or service status changes', 'Follow-ups on a request the customer made'],
    examples: ['Hi {{FirstName}}, your order has shipped and will arrive on Friday.', 'Reminder: your appointment is tomorrow at 4 PM.'],
    notFor: 'Anything promotional. Cold outreach to a lead who has not interacted with you is Marketing, even if it is worded as an update.',
    billing: 'A lower rate than Marketing: each send uses only a fraction of a quota unit (the ratio follows the platform’s per-category prices).',
  },
  [TemplateCategory.Authentication]: {
    category: TemplateCategory.Authentication,
    icon: 'verified_user',
    tone: 'authentication',
    summary: 'One-time passcodes and identity checks — verification and login codes only.',
    description:
      'For confirming a customer’s identity: a one-time password or verification code, usually with a copy-code button. Meta fixes ' +
      'the wording and forbids extra content such as links, media or emojis, so these templates are very restricted.',
    goodFor: ['One-time passwords (OTP)', 'Sign-in and account recovery codes', 'Transaction or identity verification'],
    examples: ['{{1}} is your verification code. For your security, do not share it.'],
    notFor: 'Anything that is not a code — including welcome messages, receipts or reminders.',
    billing: 'Billed at its own rate, generally well below Marketing, so each send uses a fraction of a quota unit.',
  },
};

/** Safe lookup for a value typed `TemplateCategory | string` at the call site (MessageTemplate.category). */
export function templateCategoryInfo(category: string): TemplateCategoryInfo | null {
  return TEMPLATE_CATEGORY_INFO[category as TemplateCategory] ?? null;
}

/** MessageTemplateSyncOneResultDto — POST /message-templates/{id}/sync. */
export interface MessageTemplateSyncOneResult {
  template: MessageTemplate;
  pushError: string | null;
}
