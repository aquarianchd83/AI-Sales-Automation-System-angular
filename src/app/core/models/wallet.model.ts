/**
 * The single credit wallet. One balance pays for every feature; what each feature spent is kept in its own ledger, the tenant can cap each feature per
 * month, and a tenant's plan decides which features it has at all (the rest are hidden in the app and refused by the API).
 */

/** The product areas a plan can include and a tenant can cap. Sent as the name (the API serialises this enum as a string). */
export type PlatformFeature = 'WhatsAppMessaging' | 'AiConversations' | 'LeadDiscovery' | 'ContentStudio' | 'ProductKnowledge';

export const PLATFORM_FEATURES: PlatformFeature[] = ['WhatsAppMessaging', 'AiConversations', 'LeadDiscovery', 'ContentStudio', 'ProductKnowledge'];

export const PLATFORM_FEATURE_LABELS: Record<PlatformFeature, string> = {
  WhatsAppMessaging: 'WhatsApp messaging',
  AiConversations: 'AI conversations',
  LeadDiscovery: 'Lead discovery',
  ContentStudio: 'Content Studio',
  ProductKnowledge: 'Product knowledge',
};

export const PLATFORM_FEATURE_ICONS: Record<PlatformFeature, string> = {
  WhatsAppMessaging: 'chat',
  AiConversations: 'smart_toy',
  LeadDiscovery: 'travel_explore',
  ContentStudio: 'auto_awesome',
  ProductKnowledge: 'menu_book',
};

/** What an action costs. `unitLabel` is what one unit is ("reply", "message", "candidate", "step", "video", "action"). */
export interface FeatureCost {
  /** The numeric CreditScenario. */
  scenario: number;
  title: string;
  unitLabel: string;
  credits: number;
  /** True when the credits are per action (product knowledge) rather than per unit the code sizes. */
  perAction: boolean;
}

export interface FeatureWallet {
  feature: PlatformFeature;
  label: string;
  description: string;
  /** False for a feature the plan does not include. */
  includedInPlan: boolean;
  spentThisMonth: number;
  /** The tenant's own limit on this feature's credits per calendar month, or null for none. */
  monthlyCap: number | null;
  costs: FeatureCost[];
}

export interface WalletSummary {
  balance: number;
  planCode: string | null;
  planName: string | null;
  monthlyCredits: number;
  monthStartUtc: string;
  features: FeatureWallet[];
}

/** What the signed-in tenant may see and use, and what each action costs - light enough to load for every user. */
export interface Entitlements {
  planCode: string | null;
  planName: string | null;
  features: PlatformFeature[];
  balance: number;
  costs: CreditCostItem[];
}

export interface CreditCostItem {
  feature: PlatformFeature;
  scenario: number;
  title: string;
  unitLabel: string;
  credits: number;
  perAction: boolean;
}

export interface SetFeatureCapRequest {
  feature: PlatformFeature;
  /** Null removes the cap. */
  monthlyLimit: number | null;
}

/** "1 credit" / "2 credits" / "0.5 credits". */
export function creditsLabel(credits: number): string {
  const text = credits.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${text} ${credits === 1 ? 'credit' : 'credits'}`;
}
