/** Which AI provider a top-up was for. Mirrors the API's AiModelProvider (serialised as numbers). */
export enum WalletProvider {
  OpenAI = 0,
  Google = 1,
  Anthropic = 2,
}

/** The provider names the admin knows them by, in the order the form lists them. */
export const WALLET_PROVIDERS: { value: WalletProvider; label: string }[] = [
  { value: WalletProvider.OpenAI, label: 'ChatGPT' },
  { value: WalletProvider.Anthropic, label: 'Claude' },
  { value: WalletProvider.Google, label: 'Gemini' },
];

export function walletProviderLabel(provider: WalletProvider): string {
  return WALLET_PROVIDERS.find((p) => p.value === provider)?.label ?? String(provider);
}

/** GET /platform/wallet/summary - the one platform wallet: everything added so far, in rupees. */
export interface PlatformWalletSummary {
  balance: number;
  topUpCount: number;
  /** yyyy-MM-dd, or null with no top-ups. */
  lastTopUpDate: string | null;
}

/** One row of GET /platform/wallet/top-ups. `date` is the day the admin said the money was added (yyyy-MM-dd). */
export interface WalletTopUp {
  id: string;
  date: string;
  provider: WalletProvider;
  amount: number;
  addedAtUtc: string;
}

/** Body of POST /platform/wallet/top-ups. */
export interface AddWalletTopUpRequest {
  /** yyyy-MM-dd */
  date: string;
  provider: WalletProvider;
  amount: number;
}
