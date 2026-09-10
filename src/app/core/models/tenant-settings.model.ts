/**
 * TenantWhatsAppConfigDto. Same masking convention as SettingItem: secrets (accessToken, appSecret,
 * webhookVerifyToken) never round-trip — `hasAccessToken`/`hasAppSecret`/`hasWebhookVerifyToken` are
 * the only signal of what's stored. `appId` isn't a secret, so it round-trips in full.
 *
 * `hasWebhookVerifyToken` and `appId` are both stored for record-keeping/a future per-tenant-App
 * architecture — neither is what the backend's webhook routing actually keys off today (Meta
 * subscribes per-App, one shared platform Meta App under BYO-WABA, not per-WABA — see Configuration
 * → WhatsApp for the platform-global App this still runs through regardless of what's saved here).
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
  appId: string | null;
}

/** UpdateTenantWhatsAppConfigRequest — accessToken/appSecret/webhookVerifyToken null (omitted)
 * leaves the stored value unchanged; empty string explicitly clears it. `appId` isn't a secret and
 * follows the plainer "blank leaves it unchanged" convention apiVersion/apiBaseUrl already use —
 * there's no way to clear it back to null through this request. */
export interface UpdateTenantWhatsAppConfigRequest {
  phoneNumberId: string;
  whatsAppBusinessAccountId: string;
  accessToken?: string | null;
  appSecret?: string | null;
  apiVersion?: string | null;
  apiBaseUrl?: string | null;
  webhookVerifyToken?: string | null;
  appId?: string | null;
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
