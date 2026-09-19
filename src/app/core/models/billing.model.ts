/** PlanDto — one row of the public plan catalog (GET /billing/plans, no auth required).
 * priceMonthlyCents stays the base USD list price; currencyCode/currencySymbol/localPriceAmount are
 * a display/quote figure resolved server-side from the caller's country (an authenticated tenant's
 * own stored country, or an anonymous caller's ?country= query param). */
/** One tax added on top of a price: "GST 18%", or "CGST 9%" and "SGST 9%" as two lines. */
export interface TaxLine {
  name: string;
  ratePercent: number;
  amount: number;
}

/** "CGST 9% ₹89.91 + SGST 9% ₹89.91" — how a tax is spelled out beside a price. Empty when there is no tax. */
export function taxBreakdown(lines: TaxLine[] | null | undefined, symbol: string): string {
  return (lines ?? [])
    .map((l) => `${l.name} ${l.ratePercent}% ${formatMoney(symbol, Math.abs(l.amount))}`)
    .join(' + ');
}

/** Money with two decimals, or none when it is a whole amount. */
export function formatMoney(symbol: string, amount: number): string {
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** A state a tenant can be in, where the tax splits by state (India). */
export interface IndianState {
  code: string;
  name: string;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  maxUsers: number;
  maxMessagesPerMonth: number;
  maxCampaigns: number;
  maxKnowledgeBaseArticles: number;
  maxLeadDiscoveryBatchSize: number;
  priceMonthlyCents: number;
  currencyCode: string;
  currencySymbol: string;
  /** The price set for this country, before tax. A plan with no price for the country is not returned at all. */
  localPriceAmount: number;
  /** What the plan includes each billing period, per prepaid quota type. */
  includedQuotas: IncludedQuota[];
  /** Tax added on top of localPriceAmount for this tenant, and what they would pay in all. */
  taxLines: TaxLine[];
  taxLocal: number;
  totalLocal: number;
}

export interface IncludedQuota {
  quotaType: QuotaType;
  units: number;
}

/**
 * Renders a usage charge. A cheap month genuinely costs a fraction of a cent, which `| currency` would
 * render as "$0.00" and read as free — so anything below a cent keeps four decimals, and everything else
 * uses the ordinary two. Shared by the tenant Settings charges card and the platform usage table.
 */
export function formatCharge(amount: number, symbol = '$'): string {
  // Exactly zero is "nothing spent", not a tiny amount, so it gets the plain two decimals — a column of
  // "$0.0000" reads as noise.
  const decimals = amount === 0 || Math.abs(amount) >= 0.01 ? 2 : 4;
  return `${symbol}${amount.toFixed(decimals)}`;
}

/** RegionDto — one row of the public region catalog (GET /billing/regions, no auth required),
 * what the signup page's country picker renders. */
export interface RegionOption {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string;
}

/** TimeZoneOption (GET /timezones, no auth required) — the same curated IANA timezone list backs
 * the signup page's picker, the tenant's own Workspace settings editor, and the Platform Admin
 * Console's tenant detail override. */
export interface TimeZoneOption {
  id: string;
  displayName: string;
  utcOffset: string;
}

/** SubscriptionDto — the calling tenant's current billing state. The whole object is null when
 * the tenant has no Subscription row at all yet (still on its signup trial). currentPeriodStartUtc/
 * currentPeriodEndUtc are both set together by choosing a plan (see BillingService.choosePlan), or
 * left null if the tenant's plan was only ever set by a PlatformSuperAdmin's plan override. */
export interface Subscription {
  planId: string | null;
  planName: string | null;
  status: string;
  currentPeriodStartUtc: string | null;
  currentPeriodEndUtc: string | null;
}

/** PaymentDto — one row of the calling tenant's payment history (GET /billing/payments), most
 * recent first. provider is "Simulated" for every row today (see BillingService.choosePlan) — a
 * real payment gateway's rows, once one is wired in, carry their own provider name here instead. */
export interface Payment {
  id: string;
  planName: string;
  amountCents: number;
  currencyCode: string;
  currencySymbol: string;
  localAmount: number;
  provider: string;
  paidAtUtc: string;
  /** "Subscription", "CreditPack" or "Refund" — a refund row carries negative amounts. */
  kind: string;
  /** localAmount is the price before tax; the tenant paid totalLocal. Absent on payments from before tax was recorded. */
  countryCode?: string | null;
  taxLocal?: number;
  totalLocal?: number;
  taxLines?: TaxLine[];
  amountInr?: number;
}

// ---------------------------------------------------------------------------
// Prepaid quota, credits, alerts and refunds. Every enum below is a plain int on the wire (the API
// has no string-enum converter) — the numbers mirror the backend enums exactly.
// ---------------------------------------------------------------------------

export enum QuotaType {
  WhatsAppMessages = 0,
  AiConversations = 1,
  LeadCandidates = 2,
}

export const QUOTA_TYPE_LABELS: Record<QuotaType, string> = {
  [QuotaType.WhatsAppMessages]: 'WhatsApp messages',
  [QuotaType.AiConversations]: 'AI conversations',
  [QuotaType.LeadCandidates]: 'Lead candidates',
};

export const QUOTA_TYPE_ICONS: Record<QuotaType, string> = {
  [QuotaType.WhatsAppMessages]: 'chat',
  [QuotaType.AiConversations]: 'smart_toy',
  [QuotaType.LeadCandidates]: 'travel_explore',
};

export const QUOTA_TYPES: QuotaType[] = [QuotaType.WhatsAppMessages, QuotaType.AiConversations, QuotaType.LeadCandidates];

export enum QuotaGrantOrigin {
  PlanAllocation = 0,
  CreditPurchase = 1,
  Adjustment = 2,
  Trial = 3,
}

export const QUOTA_GRANT_ORIGIN_LABELS: Record<QuotaGrantOrigin, string> = {
  [QuotaGrantOrigin.PlanAllocation]: 'Included in plan',
  [QuotaGrantOrigin.CreditPurchase]: 'Purchased credits',
  [QuotaGrantOrigin.Adjustment]: 'Adjustment',
  [QuotaGrantOrigin.Trial]: 'Free trial',
};

export enum QuotaEntryType {
  Allocation = 0,
  Purchase = 1,
  Consumption = 2,
  ConsumptionReversal = 3,
  AdjustmentCredit = 4,
  AdjustmentDebit = 5,
  Expiry = 6,
  RefundClawback = 7,
  RefundHold = 8,
  RefundRelease = 9,
}

export const QUOTA_ENTRY_LABELS: Record<QuotaEntryType, string> = {
  [QuotaEntryType.Allocation]: 'Plan allocation',
  [QuotaEntryType.Purchase]: 'Credits purchased',
  [QuotaEntryType.Consumption]: 'Used',
  [QuotaEntryType.ConsumptionReversal]: 'Returned (failed send)',
  [QuotaEntryType.AdjustmentCredit]: 'Adjustment (added)',
  [QuotaEntryType.AdjustmentDebit]: 'Adjustment (removed)',
  [QuotaEntryType.Expiry]: 'Expired',
  [QuotaEntryType.RefundClawback]: 'Refund',
  [QuotaEntryType.RefundHold]: 'Held for refund',
  [QuotaEntryType.RefundRelease]: 'Refund hold released',
};

/** Renders a unit count — WhatsApp weights make quarter-units possible, so up to two decimals, none when whole. */
export function formatUnits(units: number): string {
  return units.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export interface QuotaGrant {
  id: string;
  origin: QuotaGrantOrigin;
  unitsGranted: number;
  unitsRemaining: number;
  expiresAtUtc: string;
}

export interface QuotaBalance {
  quotaType: QuotaType;
  balance: number;
  /** Everything the live grants started with, including ones already used up — so "used it all" (balance 0,
   * capacity above 0) reads differently from "never had any" (both 0). `grants` lists only those with units left. */
  capacity: number;
  grants: QuotaGrant[];
}

export interface QuotaLedgerEntry {
  id: string;
  quotaType: QuotaType;
  entryType: QuotaEntryType;
  unitsDelta: number;
  balanceAfter: number;
  grantId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  occurredAtUtc: string;
}

export interface QuotaLedgerQuery {
  page?: number;
  pageSize?: number;
  quotaType?: QuotaType;
}

/** CreditPackDto — priced in the tenant's own currency; priceCents stays the base USD price. */
export interface CreditPack {
  id: string;
  quotaType: QuotaType;
  name: string;
  units: number;
  priceCents: number;
  currencyCode: string;
  currencySymbol: string;
  localPriceAmount: number;
  taxLines: TaxLine[];
  taxLocal: number;
  totalLocal: number;
}

export interface BillingCapabilities {
  /** Whether the platform operator has switched refund requests on for this tenant. */
  refundRequestsEnabled: boolean;
}

export interface BillingAlertSettings {
  email: string | null;
  phoneE164: string | null;
  whatsAppEnabled: boolean;
}

export enum DeliveryStatus {
  NotAttempted = 0,
  Sent = 1,
  Failed = 2,
  Skipped = 3,
}

export enum TenantNotificationKind {
  QuotaLow20 = 0,
  QuotaLow5 = 1,
  QuotaExhausted = 2,
  CreditsExpiring14 = 3,
  CreditsExpiring3 = 4,
  RefundApproved = 5,
  RefundRejected = 6,
  RefundExpired = 7,
}

export interface TenantNotification {
  id: string;
  kind: TenantNotificationKind;
  quotaType: QuotaType | null;
  title: string;
  body: string;
  emailStatus: DeliveryStatus;
  whatsAppStatus: DeliveryStatus;
  createdAt: string;
  acknowledged: boolean;
}

/** True for the alerts that mean something has stopped or is about to — drawn in a warning colour. */
export function isUrgentNotification(kind: TenantNotificationKind): boolean {
  return (
    kind === TenantNotificationKind.QuotaExhausted ||
    kind === TenantNotificationKind.QuotaLow5 ||
    kind === TenantNotificationKind.CreditsExpiring3
  );
}

export enum RefundStatus {
  Requested = 0,
  Refunded = 1,
  Rejected = 2,
  Failed = 3,
  Cancelled = 4,
  Expired = 5,
}

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  [RefundStatus.Requested]: 'Waiting for review',
  [RefundStatus.Refunded]: 'Refunded',
  [RefundStatus.Rejected]: 'Declined',
  [RefundStatus.Failed]: 'Payout failed',
  [RefundStatus.Cancelled]: 'Withdrawn',
  [RefundStatus.Expired]: 'Closed (no answer)',
};

export interface RefundEligibility {
  paymentId: string;
  eligible: boolean;
  reason: string | null;
  amountCents: number;
  localAmount: number;
  currencyCode: string;
  currencySymbol: string;
  windowEndsAtUtc: string | null;
}

export interface RefundRequest {
  id: string;
  tenantId: string;
  tenantName: string;
  paymentId: string;
  paymentDescription: string;
  status: RefundStatus;
  reason: string;
  eligibleAmountCents: number;
  eligibleLocalAmount: number;
  currencyCode: string;
  currencySymbol: string;
  refundedAmountCents: number | null;
  refundedLocalAmount: number | null;
  reviewNote: string | null;
  failureReason: string | null;
  createdAt: string;
  reviewedAtUtc: string | null;
}
