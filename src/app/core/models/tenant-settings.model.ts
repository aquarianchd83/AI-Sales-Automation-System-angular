/**
 * TenantWhatsAppConfigDto. Same masking convention as SettingItem: secrets (accessToken, appSecret,
 * webhookVerifyToken) never round-trip — `hasAccessToken`/`hasAppSecret`/`hasWebhookVerifyToken` are
 * the only signal of what's stored.
 *
 * `hasWebhookVerifyToken` is stored for schema completeness/a future per-tenant handshake — it is
 * NOT what the backend's webhook verification handshake actually checks today (Meta subscribes per-
 * App, one shared platform Meta App under BYO-WABA, not per-WABA, so that still uses one platform-
 * global verify token regardless of what's saved here). There's no per-tenant `appId` field at all:
 * the Meta App itself is platform-global too (Configuration → WhatsApp), not something each tenant
 * has its own copy of.
 */
export interface TenantWhatsAppConfig {
  phoneNumberId: string | null;
  whatsAppBusinessAccountId: string | null;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  apiVersion: string | null;
  apiBaseUrl: string | null;
  isConnected: boolean;
  hasWebhookVerifyToken: boolean;
}

/** UpdateTenantWhatsAppConfigRequest — accessToken/appSecret/webhookVerifyToken null (omitted)
 * leaves the stored value unchanged; empty string explicitly clears it. */
export interface UpdateTenantWhatsAppConfigRequest {
  phoneNumberId: string;
  whatsAppBusinessAccountId: string;
  accessToken?: string | null;
  appSecret?: string | null;
  apiVersion?: string | null;
  apiBaseUrl?: string | null;
  webhookVerifyToken?: string | null;
}

/** TenantAiProviderConfigDto. Same masking convention as TenantWhatsAppConfig, one flag per
 * provider's API key. */
export interface TenantAiProviderConfig {
  provider: string;
  embeddingProvider: string;
  hasAnthropicApiKey: boolean;
  anthropicModel: string;
  hasOpenAiApiKey: boolean;
  openAiChatModel: string;
  openAiEmbeddingModel: string;
  hasGoogleApiKey: boolean;
  googleChatModel: string;
  googleEmbeddingModel: string;
}

/** UpdateTenantAiProviderConfigRequest — any null field leaves the current value (or built-in
 * default, on first save) unchanged; empty string clears an API key. */
export interface UpdateTenantAiProviderConfigRequest {
  provider?: string | null;
  embeddingProvider?: string | null;
  anthropicApiKey?: string | null;
  anthropicModel?: string | null;
  openAiApiKey?: string | null;
  openAiChatModel?: string | null;
  openAiEmbeddingModel?: string | null;
  googleApiKey?: string | null;
  googleChatModel?: string | null;
  googleEmbeddingModel?: string | null;
}

/** The chat providers a tenant can pick for AiProviderConfig.provider. */
export const AI_CHAT_PROVIDERS: string[] = ['Simulated', 'Anthropic', 'OpenAI', 'Google'];

/** The embedding providers a tenant can pick for AiProviderConfig.embeddingProvider — Anthropic
 * has no embeddings endpoint, so it is not offered here. */
export const AI_EMBEDDING_PROVIDERS: string[] = ['Simulated', 'OpenAI', 'Google'];
