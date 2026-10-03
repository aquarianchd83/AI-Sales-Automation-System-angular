/** PlatformWhatsAppSettingsDto - the number the platform sends tenant notices from. The access token is never returned, only a hint. */
export interface PlatformWhatsAppSettings {
  enabled: boolean;
  phoneNumberId: string;
  whatsAppBusinessAccountId: string;
  hasAccessToken: boolean;
  accessTokenHint: string | null;
  apiVersion: string;
  apiBaseUrl: string;
  /** Switched on with a phone number id and a token. */
  isConfigured: boolean;
  /** Configured and has a business account id - what pushing templates to Meta needs. */
  canManageTemplates: boolean;
}

/** accessToken: null keeps the stored one, '' clears it, anything else replaces it. */
export interface UpdatePlatformWhatsAppSettingsRequest {
  enabled: boolean;
  phoneNumberId: string;
  whatsAppBusinessAccountId: string;
  accessToken: string | null;
  apiVersion: string;
  apiBaseUrl: string;
}

export type PlatformTemplateStatus = 'Pending' | 'Approved' | 'Rejected';

/** PlatformMessageTemplateDto - one WhatsApp template per kind of tenant notice. */
export interface PlatformMessageTemplate {
  id: string;
  /** The notice this template carries, e.g. "PlanExpiring7". */
  eventKey: string;
  name: string;
  language: string;
  category: string;
  whatsAppTemplateName: string;
  status: PlatformTemplateStatus;
  bodyText: string;
  /** The wording it was seeded with - what "Restore default" brings back. */
  defaultBodyText: string;
  /** What {{Message}} looks like for this notice: the example Meta reviews and a test send shows. */
  sampleMessage: string;
  isActive: boolean;
  metaTemplateId: string | null;
  headerMediaAssetId: string | null;
  /** True once Meta holds the template WITH an image header; that is fixed at creation. */
  headerOnMeta: boolean;
  headerFileName: string | null;
  headerUrl: string | null;
  headerPreviewUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** headerMediaAssetId: null keeps the current image; removeHeaderImage clears it. */
export interface UpdatePlatformMessageTemplateRequest {
  name: string;
  bodyText: string;
  isActive: boolean;
  headerMediaAssetId: string | null;
  removeHeaderImage: boolean;
}

export interface PlatformTemplateSyncResult {
  configured: boolean;
  note: string | null;
  created: number;
  updated: number;
  failures: string[];
  remoteCount: number;
  statusUpdated: number;
}

/** What a notice can fill in. Anything else in a body is refused by the server. */
export const PLATFORM_TEMPLATE_TOKENS = ['TenantName', 'Title', 'Message'] as const;
export type PlatformTemplateToken = (typeof PLATFORM_TEMPLATE_TOKENS)[number];

export const PLATFORM_TEMPLATE_TOKEN_HELP: Record<PlatformTemplateToken, string> = {
  TenantName: "The company's name",
  Title: "The notice's headline",
  Message: 'The details: amounts, dates, what to do',
};

/** Meta's limit for a template body. */
export const PLATFORM_TEMPLATE_MAX_BODY = 1024;

/** The sample values a preview shows, as the server sends them to Meta for review. */
export const PLATFORM_TEMPLATE_SAMPLE_TENANT = 'Acme Traders';
export const PLATFORM_TEMPLATE_SAMPLE_TITLE = 'Your plan renews soon';

/** Fills a body's {{Tokens}} with sample values, the way a notice would read to a tenant. */
export function renderTemplatePreview(body: string, sampleMessage: string): string {
  const values: Record<string, string> = {
    TenantName: PLATFORM_TEMPLATE_SAMPLE_TENANT,
    Title: PLATFORM_TEMPLATE_SAMPLE_TITLE,
    Message: sampleMessage,
  };
  return body.replace(/\{\{(\w+)\}\}/g, (whole, token: string) => values[token] ?? whole);
}

/** The tokens a body uses that a notice cannot fill. */
export function unknownTemplateTokens(body: string): string[] {
  const known = new Set<string>(PLATFORM_TEMPLATE_TOKENS);
  const found = new Set<string>();
  for (const match of body.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!known.has(match[1])) {
      found.add(match[1]);
    }
  }
  return [...found];
}

/** Meta refuses a template that starts or ends with a variable. */
export function startsOrEndsWithToken(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.startsWith('{{') || trimmed.endsWith('}}');
}
