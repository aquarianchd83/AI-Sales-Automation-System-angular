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
  /** When Meta last confirmed these credentials reach the phone number ("Verify connection"). Null: never
   * verified since the last save, or the last attempt failed. Every save clears it. */
  verifiedAtUtc?: string | null;
  /** Meta's reason the last verification failed. */
  verificationError?: string | null;
  /** The number and display name as Meta reported them on a successful verification. */
  verifiedDisplayPhoneNumber?: string | null;
  verifiedName?: string | null;
}

/** Saved, and confirmed live by Meta since. */
export function isWhatsAppVerified(config: TenantWhatsAppConfig | null | undefined): boolean {
  return !!config?.isConnected && !!config.verifiedAtUtc;
}

/** TenantWhatsAppNumberDto - the WhatsApp number the tenant gave for its customers to message (null: none yet). Just
 * the number; connecting it to WhatsApp is the separate connection form. */
export interface TenantWhatsAppNumber {
  whatsAppNumber: string | null;
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

/** TenantWhatsAppCategoryChargeDto — one template category's share. `category` is a TemplateCategory
 * name (Marketing/Utility/Authentication). */
export interface TenantWhatsAppCategoryCharge {
  category: string;
  messages: number;
  ratePerMessageUsd: number;
  estimatedCostUsd: number;
  estimatedCostLocal: number;
}

/** TenantWhatsAppChargesDto. `messagesSent` is every message this month (what the plan allowance counts);
 * `billableMessages` is the template sends Meta charges for — an inbound message or a free-form session
 * reply costs nothing, which is why the two differ. */
export interface TenantWhatsAppCharges {
  messagesSent: number;
  billableMessages: number;
  freeMessages: number;
  estimatedCostUsd: number;
  estimatedCostLocal: number;
  byCategory: TenantWhatsAppCategoryCharge[];
}

/** TenantLeadDiscoveryChargesDto — the current-month half of GET /lead-discovery/spend. */
export interface TenantLeadDiscoveryCharges {
  runs: number;
  leadsSaved: number;
  estimatedCostUsd: number;
  estimatedCostLocal: number;
}

/** TenantChargesDto (GET /tenant-settings/charges) — this calendar month's usage charges: WhatsApp
 * sending plus lead discovery, excluding the plan subscription fee. Every figure is an ESTIMATE priced
 * from hand-maintained rate tables, so any screen showing these must say so rather than implying a bill. */
export interface TenantCharges {
  currencyCode: string;
  currencySymbol: string;
  periodStartUtc: string;
  whatsApp: TenantWhatsAppCharges;
  leadDiscovery: TenantLeadDiscoveryCharges;
  totalEstimatedCostUsd: number;
  totalEstimatedCostLocal: number;
}

/**
 * TenantSettingItemDto — one tenant-overridable Campaigns/Media/Messaging/Ai tuning key (see the
 * backend's AppSettingDefinition.IsTenantOverridable doc comment for exactly which keys and why).
 * Nothing here is a secret, so every value round-trips in full — `effectiveValue` is what this tenant
 * is actually running with (== `overrideValue` when set, else == `globalValue`).
 */
export interface TenantSettingItem {
  key: string;
  category: string;
  isList: boolean;
  description: string | null;
  globalValue: string;
  overrideValue: string | null;
  effectiveValue: string;
}

export interface TenantSettingCategory {
  category: string;
  items: TenantSettingItem[];
}

/** UpdateTenantSettingsRequest — only the keys present are changed; a present key with a null/blank
 * value clears that override, reverting the tenant to the platform default for it. */
export interface UpdateTenantSettingsRequest {
  values: Record<string, string | null>;
}

/** TenantMessageUsageDto — how much of this calendar month's WhatsApp message quota the tenant has
 * used. maxMessagesPerMonth is null when the tenant has no plan yet (still on trial) and means
 * unlimited, not zero. */
export interface TenantMessageUsage {
  messagesSentThisMonth: number;
  maxMessagesPerMonth: number | null;
}
