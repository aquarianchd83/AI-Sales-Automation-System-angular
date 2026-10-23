import { QuotaType } from './billing.model';

/** Mirrors the API's CreditScenario enum (serialised as numbers). */
export enum CreditScenario {
  CustomerChatReply = 0,
  WhatsAppTemplateSend = 1,
  LeadDiscovery = 2,
  ContentStudioGeneration = 3,
  ContentStudioVideoRender = 4,
  ProductKnowledgeReading = 5,
  ProductKnowledgeAnswering = 6,
}

/** Whose balance a credit comes out of. */
export enum CreditPayer {
  Tenant = 0,
  Platform = 1,
}

export enum CreditUsageStatus {
  Charged = 0,
  /** Given back automatically because the work failed. */
  Reversed = 1,
  /** Given back to the tenant by a platform admin. */
  Redeemed = 2,
  /** The work was done but neither balance could pay for it. */
  Unpaid = 3,
}

export enum PlatformCreditEntryType {
  TopUp = 0,
  Consumption = 1,
  Reversal = 2,
  AdjustmentCredit = 3,
  AdjustmentDebit = 4,
}

export const CREDIT_PAYER_LABELS: Record<CreditPayer, string> = {
  [CreditPayer.Tenant]: 'Tenant',
  [CreditPayer.Platform]: 'Platform (you)',
};

export const CREDIT_USAGE_STATUS_LABELS: Record<CreditUsageStatus, string> = {
  [CreditUsageStatus.Charged]: 'Charged',
  [CreditUsageStatus.Reversed]: 'Returned (failed)',
  [CreditUsageStatus.Redeemed]: 'Given back to tenant',
  [CreditUsageStatus.Unpaid]: 'Unpaid',
};

export const PLATFORM_CREDIT_ENTRY_LABELS: Record<PlatformCreditEntryType, string> = {
  [PlatformCreditEntryType.TopUp]: 'Top-up',
  [PlatformCreditEntryType.Consumption]: 'Spent',
  [PlatformCreditEntryType.Reversal]: 'Returned',
  [PlatformCreditEntryType.AdjustmentCredit]: 'Added',
  [PlatformCreditEntryType.AdjustmentDebit]: 'Removed',
};

/** One scenario on the Credit Payers screen (GET /platform/credit-payers/scenarios). */
export interface CreditScenarioInfo {
  scenario: CreditScenario;
  title: string;
  area: string;
  description: string;
  quotaType: QuotaType;
  payer: CreditPayer;
  defaultPayer: CreditPayer;
  unitsConfigurable: boolean;
  unitsPerAction: number | null;
  platformBalance: number;
  actionsLast30Days: number;
  unitsChargedToPlatformLast30Days: number;
  unitsChargedToTenantsLast30Days: number;
  fallbackCountLast30Days: number;
  /** The AI provider's estimated bill for the scenario - what it really costs the platform, whoever pays the credits. */
  providerCostLast30DaysUsd: number | null;
  changedAtUtc: string | null;
  /** What one unit is - "reply", "message", "candidate", "step", "video", "action". */
  unitLabel: string;
}

export interface UpdateCreditPayerRequest {
  payer: CreditPayer;
  unitsPerAction?: number | null;
}

export interface PlatformCreditWallet {
  quotaType: QuotaType;
  balance: number;
}

export interface AdjustPlatformWalletRequest {
  quotaType: QuotaType;
  unitsDelta: number;
  reason: string;
}

export interface PlatformCreditEntry {
  id: string;
  quotaType: QuotaType;
  entryType: PlatformCreditEntryType;
  unitsDelta: number;
  balanceAfter: number;
  tenantId: string | null;
  tenantName: string | null;
  note: string | null;
  occurredAtUtc: string;
}

export interface CreditUsage {
  id: string;
  tenantId: string;
  tenantName: string;
  scenario: CreditScenario;
  scenarioTitle: string;
  quotaType: QuotaType;
  units: number;
  configuredPayer: CreditPayer;
  chargedTo: CreditPayer;
  fellBackToTenant: boolean;
  status: CreditUsageStatus;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  occurredAtUtc: string;
  settledAtUtc: string | null;
  settlementNote: string | null;
}

export interface CreditUsageQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  scenario?: CreditScenario | null;
  chargedTo?: CreditPayer | null;
  status?: CreditUsageStatus | null;
  fellBackToTenant?: boolean | null;
  tenantId?: string | null;
}

/** What a tenant sees of its own credit usage (GET /billing/credit-usage). */
export interface TenantCreditUsage {
  id: string;
  scenario: CreditScenario;
  scenarioTitle: string;
  quotaType: QuotaType;
  units: number;
  coveredByPlatform: boolean;
  refunded: boolean;
  description: string | null;
  occurredAtUtc: string;
}

/** True when the credit usage can be given back to the tenant by a platform admin. */
export function canRedeem(usage: CreditUsage): boolean {
  return usage.chargedTo === CreditPayer.Tenant && usage.status === CreditUsageStatus.Charged && usage.units > 0;
}

export interface TenantCreditUsageQuery {
  page?: number;
  pageSize?: number;
  scenario?: CreditScenario | null;
  coveredByPlatform?: boolean | null;
}
