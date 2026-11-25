/**
 * The single credit wallet. One balance pays for every feature; what each feature spent is kept in its own ledger, the tenant can cap each feature per
 * month, and a tenant's plan decides which features it has at all (the rest are hidden in the app and refused by the API).
 */

/** The product areas a plan can include and a tenant can cap. Sent as the name (the API serialises this enum as a string). */
export type PlatformFeature = 'WhatsAppMessaging' | 'Campaigns' | 'AiConversations' | 'LeadDiscovery' | 'ContentStudio' | 'ProductKnowledge';

export const PLATFORM_FEATURES: PlatformFeature[] = ['WhatsAppMessaging', 'Campaigns', 'AiConversations', 'LeadDiscovery', 'ContentStudio', 'ProductKnowledge'];

/** The features that spend credits, so have a ledger, a monthly cap and a line in the wallet. Campaigns only gates access: its sends are WhatsApp messaging. */
export const SPENDING_FEATURES: PlatformFeature[] = PLATFORM_FEATURES.filter((f) => f !== 'Campaigns');

export const PLATFORM_FEATURE_LABELS: Record<PlatformFeature, string> = {
  WhatsAppMessaging: 'WhatsApp messaging',
  Campaigns: 'Campaigns',
  AiConversations: 'AI conversations',
  LeadDiscovery: 'Lead discovery',
  ContentStudio: 'Content Studio',
  ProductKnowledge: 'Product knowledge',
};

export const PLATFORM_FEATURE_ICONS: Record<PlatformFeature, string> = {
  WhatsAppMessaging: 'chat',
  Campaigns: 'campaign',
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
  /** What the action is, for the Credit costs page. */
  description?: string;
}

/**
 * Free uses of a feature the tenant's plan does NOT include (e.g. 10 free leads of lead discovery on Basic). While some are left the feature is open
 * and listed in `Entitlements.features`; once they are gone it is locked like any feature outside the plan, until the tenant upgrades. Lifetime, not monthly.
 */
export interface FeatureTrial {
  feature: PlatformFeature;
  label: string;
  freeUses: number;
  used: number;
  remaining: number;
  exhausted: boolean;
  /** What one use is, plural ("leads", "AI generations"). */
  unit: string;
  unitSingular: string;
  /** True when the plan includes the feature but caps it (Basic: 100 AI replies); false for free uses of a feature outside the plan. */
  includedInPlan?: boolean;
}

/** "7 of 10 free leads left" for free uses, "80 of 100 AI replies left" for a plan's cap. */
export function trialLeftLabel(trial: FeatureTrial): string {
  return `${trial.remaining} of ${trial.freeUses} ${trial.includedInPlan ? '' : 'free '}${trial.freeUses === 1 ? trial.unitSingular : trial.unit} left`;
}

/** The tooltip on an add/run button that is off because the feature's free uses are used up (its screens stay open, read-only). */
export const USED_UP_HINT = 'Your plan limit is used up. Upgrade to Premium to add new.';

/** "You have used all 10 free leads of Lead discovery included with your Basic plan." */
export function trialUsedUpLabel(trial: FeatureTrial, planName: string | null): string {
  const unit = trial.freeUses === 1 ? trial.unitSingular : trial.unit;
  return `You have used all ${trial.freeUses} ${trial.includedInPlan ? '' : 'free '}${unit} of ${trial.label} included with your ${planName || 'current'} plan.`;
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
  /** Set when the plan does not include the feature but gives free uses of it. */
  freeTrial?: FeatureTrial | null;
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
  /** Features the plan does not include but gives free uses of (used up or not). Absent from an older API. */
  trials?: FeatureTrial[] | null;
  /** Plan limits that are not a feature of their own (the customer and user limits). Absent when the plan has none. */
  quotas?: PlanQuota[] | null;
}

/** A plan limit that is not a feature: "4 of 10 customers left". */
export interface PlanQuota {
  key: 'Customers' | 'Users' | string;
  label: string;
  limit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
  unit: string;
  unitSingular: string;
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

/** One feature's platform-wide publish switch, as the platform admin's Features page shows it. */
export interface PlatformFeatureSwitch {
  feature: PlatformFeature;
  label: string;
  description: string;
  /** False when unpublished: hidden from every tenant and refused by the API, whatever its plan includes. */
  published: boolean;
  /** When the switch was last changed (UTC; show it with the `zonedDate` pipe), or null if never. */
  updatedAtUtc: string | null;
}
