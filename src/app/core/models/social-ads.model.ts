export type SocialAdsConnectionStatus = 'NotConnected' | 'PendingAccountSelection' | 'Connected' | 'NeedsReconnect';

/** SocialAdAccountDto — an ad account the Facebook login can read. */
export interface SocialAdAccount {
  id: string;
  name: string;
  currencyCode: string;
}

/**
 * SocialAdsStatusDto. `isAvailable` is false until the platform has a Meta App configured, in which case nothing can be
 * connected yet. The access token is never part of this — the API does not return it.
 */
export interface SocialAdsStatus {
  isAvailable: boolean;
  status: SocialAdsConnectionStatus;
  adAccountId: string | null;
  adAccountName: string | null;
  currencyCode: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  tokenExpiresAt: string | null;
  /** Only filled while status is PendingAccountSelection. */
  accounts: SocialAdAccount[];
}

export interface SocialAdsConnectUrl {
  url: string;
}

/** CompleteSocialAdsConnectRequest — what Facebook sent back to the redirect page. */
export interface CompleteSocialAdsConnectRequest {
  code: string;
  state: string;
  redirectUri: string;
}

/** ManualAdSpendDto — a month's ad spend typed in by hand, for a tenant with no ad account to connect. */
export interface ManualAdSpend {
  month: string;
  amount: number;
  currencyCode: string;
}

/** SaveManualAdSpendRequest — `month` is any date in the month; an `amount` of 0 clears it. */
export interface SaveManualAdSpendRequest {
  month: string;
  amount: number;
}

/** The page Facebook returns the tenant to after login. Must match an address registered on the Meta App. */
export const SOCIAL_ADS_PATH = '/social-ads';

export function socialAdsRedirectUri(origin: string): string {
  return `${origin}${SOCIAL_ADS_PATH}`;
}

/** The last `count` months as first-of-month ISO dates (UTC), newest first, for the typed-in spend picker. */
export function recentMonths(now: Date, count: number): string[] {
  const months: string[] = [];
  for (let i = 0; i < count; i++) {
    months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString());
  }
  return months;
}
