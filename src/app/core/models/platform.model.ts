import { IncludedQuota, QuotaType } from './billing.model';
import { AppRole } from './user.model';

/**
 * The Platform Admin Console (backend `Platform*Controller`s under `/api/v1/platform/*`, plus
 * `/api/v1/announcements`) is PlatformSuperAdmin-only — verified against a running instance's
 * `/swagger/v1/swagger.json` and by exercising every endpoint live while building this module.
 */
export const PLATFORM_ADMIN_ROLES: string[] = [AppRole.PlatformSuperAdmin];

/** TenantStatus — plain int enum, not a string (verified from a live response, e.g. `"status":0`). */
export enum TenantStatus {
  Trial = 0,
  Active = 1,
  Suspended = 2,
  Cancelled = 3,
  /** Operator-initiated terminal state (the Tenants screen's Delete action) — distinct from
   * Cancelled (customer-initiated). Never a physical delete of the tenant's data. */
  Deleted = 4,
}

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  [TenantStatus.Trial]: 'Trial',
  [TenantStatus.Active]: 'Active',
  [TenantStatus.Suspended]: 'Suspended',
  [TenantStatus.Cancelled]: 'Cancelled',
  [TenantStatus.Deleted]: 'Deleted',
};

/** SubscriptionStatus — mirrors Stripe's own vocabulary, collapsed to four values. */
export enum SubscriptionStatus {
  Trialing = 0,
  Active = 1,
  PastDue = 2,
  Canceled = 3,
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Trialing]: 'Trialing',
  [SubscriptionStatus.Active]: 'Active',
  [SubscriptionStatus.PastDue]: 'Past due',
  [SubscriptionStatus.Canceled]: 'Canceled',
};

export enum AnnouncementSeverity {
  Info = 0,
  Warning = 1,
  Critical = 2,
}

export const ANNOUNCEMENT_SEVERITY_LABELS: Record<AnnouncementSeverity, string> = {
  [AnnouncementSeverity.Info]: 'Info',
  [AnnouncementSeverity.Warning]: 'Warning',
  [AnnouncementSeverity.Critical]: 'Critical',
};

// ---------------------------------------------------------------------------
// Dashboard (GET /platform/dashboard)
// ---------------------------------------------------------------------------

/** PlatformDashboardDto. mrrUsd/estimatedAiSpendThisMonthUsd are both estimates — see the
 * backend's own AiSpendEstimator/PlatformDashboardService doc comments. */
/** PlatformDashboardDto. These are platform-wide figures, so `currencyCode`/`currencySymbol` and the
 * `*Local` amounts are the SIGNED-IN OPERATOR's currency (from the country on their own profile), not any
 * tenant's — a per-tenant figure is quoted in that tenant's currency instead (see PlatformTenantUsage). */
export interface PlatformDashboard {
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  signupsThisMonth: number;
  mrrUsd: number;
  messagesSentThisMonth: number;
  aiInteractionsThisMonth: number;
  estimatedAiSpendThisMonthUsd: number;
  webhookFailuresLast24h: number;
  systemHealthy: boolean;
  currencyCode: string;
  currencySymbol: string;
  mrrLocal: number;
  estimatedAiSpendThisMonthLocal: number;
}

// ---------------------------------------------------------------------------
// Tenants (GET/PUT /platform/tenants/*)
// ---------------------------------------------------------------------------

export interface PlatformTenantQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TenantStatus;
}

/** PlatformTenantListItemDto. */
export interface PlatformTenantListItem {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  planName: string | null;
  userCount: number;
  createdAt: string;
  trialEndsAtUtc: string | null;
}

/** PlatformTenantDetailDto. maxMessagesPerMonth/subscriptionStatus/currentPeriodEndUtc are null
 * when the tenant has no active plan yet (still on trial, or between plans). */
export interface PlatformTenantDetail {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  trialEndsAtUtc: string | null;
  ownerUserId: string | null;
  ownerEmail: string | null;
  userCount: number;
  planName: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  currentPeriodEndUtc: string | null;
  whatsAppConnected: boolean;
  messagesSentThisMonth: number;
  maxMessagesPerMonth: number | null;
  aiInteractionsThisMonth: number;
  estimatedAiSpendThisMonthUsd: number;
  /** Always the effective value (defaults to "Asia/Kolkata" when the tenant hasn't set one) - see
   * the backend's TenantProfileDto's own doc comment. */
  timezone: string;
  /** Null when never set - plan pricing quotes in USD until it is (RegionalPricingCatalog.Resolve
   * on the backend). Unlike timezone, has no universal default. */
  countryCode: string | null;
  /** This tenant's own currency, resolved from countryCode — what they're quoted in on their own screens. */
  currencyCode: string;
  currencySymbol: string;
  estimatedAiSpendThisMonthLocal: number;
  /** Whether this tenant can ask for refunds from its own Billing page - off by default, switched on here. */
  refundRequestsEnabled: boolean;
}

/** ImpersonationSessionDto — deliberately carries no refresh token (see the backend's
 * IJwtTokenService.GenerateImpersonationAccessToken doc comment): a support session is
 * time-boxed and ends on its own rather than silently renewing. */
export interface ImpersonationSession {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  impersonatedUserId: string;
  impersonatedUserEmail: string;
  tenantId: string;
  tenantName: string;
}

export interface OverrideTenantPlanRequest {
  planId: string;
}

/** CreatePlatformTenantRequest — operator-initiated tenant creation, the Platform Admin Console's
 * counterpart to self-serve signup: same shape (a new Tenant on trial plus its first Admin user),
 * except the PlatformSuperAdmin sets adminPassword as a temporary password to hand off rather than
 * the new admin choosing their own during signup. */
export interface CreatePlatformTenantRequest {
  companyName: string;
  /** Optional — derived from companyName and de-duplicated automatically when omitted. */
  slug?: string | null;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  /** Optional business details — validated and normalized exactly like the tenant's own Business
   * Profile (see TenantProfile). countryCode/timezone must be supported values when given; timezone
   * defaults to India Standard Time like signup. */
  countryCode?: string | null;
  timezone?: string | null;
  productName?: string | null;
  industry?: string | null;
  businessDescription?: string | null;
  websiteUrl?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  domainKeywords?: string[];
}

// ---------------------------------------------------------------------------
// Billing (GET /platform/billing/*)
// ---------------------------------------------------------------------------

/** PlatformPlanDto — the platform-only view of the catalog (includes inactive plans, unlike the
 * tenant-facing PlanDto used by /billing/plans). */
export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
  maxUsers: number;
  maxMessagesPerMonth: number;
  maxCampaigns: number;
  maxKnowledgeBaseArticles: number;
  /** The most new leads one lead discovery run may add for a tenant on this plan. */
  maxLeadDiscoveryBatchSize: number;
  /** The authored base list price, always USD — what the create/update dialog edits. */
  priceMonthlyCents: number;
  isActive: boolean;
  /** The same price in the signed-in operator's currency (from their profile country), for display. The
   * catalog is still authored in USD, so a rate change never rewrites a plan. */
  currencyCode: string;
  currencySymbol: string;
  priceMonthlyLocal: number;
  /** What the plan grants each billing period, per prepaid quota type. Empty = no prepaid quota. */
  includedQuotas: IncludedQuota[];
  /** Explicit prices set per country, each in that country's own currency. A country without one is quoted the
   * USD price converted at the platform rate. */
  countryPrices: CountryPrice[];
}

/** One country's explicit price (PlatformPlanDto/PlatformCreditPackDto.countryPrices). */
export interface CountryPrice {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string;
  amount: number;
}

/** A country price being set. An amount of 0 removes the country's price. */
export interface CountryPriceInput {
  countryCode: string;
  amount: number;
}

/** One quota line of a plan write: units per billing period for a quota type (0 removes the line on update). */
export interface PlanQuotaInput {
  quotaType: QuotaType;
  units: number;
}

/** Body of POST the plan catalog endpoint. code is immutable once a plan exists — there is no
 * update path for it, only creation (see UpdatePlanRequest). maxLeadDiscoveryBatchSize omitted
 * means the backend default (25). */
export interface CreatePlanRequest {
  code: string;
  name: string;
  maxUsers: number;
  maxMessagesPerMonth: number;
  maxCampaigns: number;
  maxKnowledgeBaseArticles: number;
  priceMonthlyCents: number;
  maxLeadDiscoveryBatchSize?: number | null;
  includedQuotas?: PlanQuotaInput[] | null;
  countryPrices?: CountryPriceInput[] | null;
}

/** Body of PUT one plan. isActive is how a plan is both retired (the Delete button sets it false)
 * and un-retired — there is no separate reactivate endpoint. maxLeadDiscoveryBatchSize omitted
 * leaves the stored value unchanged. */
export interface UpdatePlanRequest {
  name: string;
  maxUsers: number;
  maxMessagesPerMonth: number;
  maxCampaigns: number;
  maxKnowledgeBaseArticles: number;
  priceMonthlyCents: number;
  isActive: boolean;
  maxLeadDiscoveryBatchSize?: number | null;
  /** Omitted leaves the plan's quotas unchanged; when sent it is the complete set. */
  includedQuotas?: PlanQuotaInput[] | null;
  /** Omitted leaves the plan's country prices unchanged; when sent it is the complete set. */
  countryPrices?: CountryPriceInput[] | null;
}

/** PlatformCreditPackDto — the credit-pack catalog. priceCents is the authored USD price; priceLocal is the
 * same in the signed-in operator's currency, for display. Retired packs (isActive false) stay listed. */
export interface PlatformCreditPack {
  id: string;
  quotaType: QuotaType;
  name: string;
  units: number;
  priceCents: number;
  isActive: boolean;
  currencyCode: string;
  currencySymbol: string;
  priceLocal: number;
  countryPrices: CountryPrice[];
}

export interface CreateCreditPackRequest {
  quotaType: QuotaType;
  name: string;
  units: number;
  priceCents: number;
  countryPrices?: CountryPriceInput[] | null;
}

export interface UpdateCreditPackRequest {
  name: string;
  units: number;
  priceCents: number;
  isActive: boolean;
  countryPrices?: CountryPriceInput[] | null;
}

export interface PlatformSubscriptionQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: SubscriptionStatus;
}

/** PlatformSubscriptionListItemDto. hasFailedPayment is derived from Status === PastDue — this
 * system keeps no per-period ledger, so it is not a history of payments. */
export interface PlatformSubscriptionListItem {
  tenantId: string;
  tenantName: string;
  planName: string | null;
  status: SubscriptionStatus | null;
  currentPeriodEndUtc: string | null;
  hasFailedPayment: boolean;
}

// ---------------------------------------------------------------------------
// Usage & Quotas (GET /platform/usage)
// ---------------------------------------------------------------------------

/** PlatformTenantUsageDto. A null *Limit means the tenant has no active plan, so no quota
 * applies — never rendered as a breach.
 *
 * The three spend figures come from three different estimators and are not interchangeable:
 * conversational AI, WhatsApp message sending, and lead discovery runs. estimatedTotalSpendThisMonthUsd
 * is their sum — what serving this tenant costs the platform this month, not what the tenant pays.
 * Every one is an estimate from a hand-maintained rate table; label them as such wherever shown. */
export interface PlatformTenantUsage {
  tenantId: string;
  tenantName: string;
  messagesSentThisMonth: number;
  messageLimit: number | null;
  messageQuotaBreached: boolean;
  userCount: number;
  userLimit: number | null;
  userQuotaBreached: boolean;
  aiInteractionsThisMonth: number;
  estimatedAiSpendThisMonthUsd: number;
  /** Template sends only — inbound and free-form session messages cost nothing. */
  billableWhatsAppMessagesThisMonth: number;
  estimatedWhatsAppSpendThisMonthUsd: number;
  leadDiscoveryRunsThisMonth: number;
  leadDiscoveryLeadsThisMonth: number;
  estimatedLeadDiscoverySpendThisMonthUsd: number;
  estimatedTotalSpendThisMonthUsd: number;
  /** When the spend window opened: the start of the month in this tenant's own timezone, so the figures
   * match what that tenant sees. The quota columns still run on the UTC month the API enforces. */
  spendPeriodStartUtc: string;
  /** This row's money in THAT TENANT's currency (from their country), matching what they're quoted on their
   * own screens. A column therefore mixes currencies and is not comparable across rows — compare or total
   * the `*Usd` figures instead. */
  currencyCode: string;
  currencySymbol: string;
  estimatedAiSpendThisMonthLocal: number;
  estimatedWhatsAppSpendThisMonthLocal: number;
  estimatedLeadDiscoverySpendThisMonthLocal: number;
  estimatedTotalSpendThisMonthLocal: number;
}

// ---------------------------------------------------------------------------
// Payments (GET /platform/payments)
// ---------------------------------------------------------------------------

/** PaymentKind as its name — the query binder accepts the enum name, and the DTO's `kind` is a string. */
export type PlatformPaymentKind = 'Subscription' | 'CreditPack' | 'Refund';

export const PLATFORM_PAYMENT_KIND_LABELS: Record<string, string> = {
  Subscription: 'Plan subscription',
  CreditPack: 'Credit pack',
  Refund: 'Refund',
};

export interface PlatformPaymentQuery {
  page: number;
  pageSize: number;
  search?: string;
  kind?: PlatformPaymentKind;
  tenantId?: string;
}

/** PlatformPaymentListItemDto — money that actually moved. Amounts are in the tenant's own currency
 * (snapshotted at charge time); a refund carries negative amounts. Total per currency, never across. */
export interface PlatformPaymentListItem {
  id: string;
  tenantId: string;
  tenantName: string;
  kind: string;
  description: string;
  amountCents: number;
  currencyCode: string;
  currencySymbol: string;
  localAmount: number;
  provider: string;
  paidAtUtc: string;
  refundOfPaymentId: string | null;
}

// ---------------------------------------------------------------------------
// WhatsApp Connections (GET /platform/whatsapp-connections)
// ---------------------------------------------------------------------------

/** PlatformWhatsAppConnectionDto — not paged (one row per tenant that has ever connected a
 * WABA). Deliberately no token-expiry field: BYO-WABA tenant tokens aren't tracked by any
 * refresh mechanism today — see the backend's TenantWhatsAppConnectionSummary doc comment. */
export interface PlatformWhatsAppConnection {
  tenantId: string;
  tenantName: string;
  phoneNumberId: string | null;
  whatsAppBusinessAccountId: string | null;
  isConnected: boolean;
  configUpdatedAtUtc: string | null;
  webhookEventsLast24h: number;
  webhookFailuresLast24h: number;
  lastWebhookReceivedAtUtc: string | null;
}

// ---------------------------------------------------------------------------
// Cross-tenant user search (GET /platform/users/search)
// ---------------------------------------------------------------------------

/** PlatformUserSearchResultDto — a capped support lookup, not a listing; the backend returns
 * nothing for a blank search term rather than every user on the platform. */
export interface PlatformUserSearchResult {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  tenantName: string | null;
  roles: string[];
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

// ---------------------------------------------------------------------------
// Audit Log (GET /platform/audit-log)
// ---------------------------------------------------------------------------

export interface PlatformAuditLogQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  targetTenantId?: string;
}

/** PlatformAuditLogEntryDto. */
export interface PlatformAuditLogEntry {
  id: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetTenantId: string | null;
  targetTenantName: string | null;
  targetUserId: string | null;
  details: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Logs (GET /logs, /logs/dates, /logs/modules)
// ---------------------------------------------------------------------------

/** Serilog's level names, most severe first. The API also accepts the 3-letter codes. */
export const LOG_LEVELS = ['Fatal', 'Error', 'Warning', 'Information', 'Debug', 'Verbose'];

/** LogQueryRequest. `date` is `YYYY-MM-DD`; the API defaults to today (IST) when it is omitted.
 * `levels` matches any of them (empty/omitted means every level). `module` is a substring match on
 * the logging class. */
export interface PlatformLogQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  date?: string;
  levels?: string[];
  module?: string;
  tenantId?: string;
}

/** LogEntryDto. `tenantId` is null for platform-level lines with no tenant, and for every line
 * written before the API started tagging lines with their tenant. */
export interface PlatformLogEntry {
  timestamp: string;
  level: string;
  module: string | null;
  method: string | null;
  message: string;
  tenantId: string | null;
  tenantName: string | null;
}

// ---------------------------------------------------------------------------
// Announcements (GET/POST/PUT/DELETE /announcements)
// ---------------------------------------------------------------------------

/** AnnouncementDto. */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  isActive: boolean;
  startsAtUtc: string | null;
  endsAtUtc: string | null;
  createdAt: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  startsAtUtc?: string | null;
  endsAtUtc?: string | null;
}

export interface UpdateAnnouncementRequest {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  isActive: boolean;
  startsAtUtc: string | null;
  endsAtUtc: string | null;
}

// ---------------------------------------------------------------------------
// Background jobs (GET/PUT/POST /platform/jobs)
// ---------------------------------------------------------------------------

/** TenantJobRunOutcome — plain int enum, like TenantStatus. How the tenant's own last run went,
 * which is not the same thing as Hangfire's job state: the per-tenant runner catches a tenant's
 * failure on purpose so one tenant cannot stall the others, so Hangfire records Succeeded either
 * way. This is the tenant-level answer. */
export enum TenantJobRunOutcome {
  Succeeded = 0,
  Failed = 1,
  /** Ran but deliberately did nothing — the tenant stopped being eligible, or the job was disabled,
   * between the schedule firing and the run starting. Not an error. */
  Skipped = 2,
}

export const TENANT_JOB_RUN_OUTCOME_LABELS: Record<TenantJobRunOutcome, string> = {
  [TenantJobRunOutcome.Succeeded]: 'Succeeded',
  [TenantJobRunOutcome.Failed]: 'Failed',
  [TenantJobRunOutcome.Skipped]: 'Skipped',
};

/** TenantJobDefinition — the server's catalog of what a per-tenant job is. Fetched rather than
 * hard-coded here so the job-type filter and the "reset to default" cron come from one definition
 * (TenantJobCatalog) instead of a second copy that drifts. */
export interface TenantJobDefinition {
  key: string;
  displayName: string;
  description: string;
  defaultCron: string;
}

/**
 * PlatformTenantJobDto — one tenant's copy of one recurring job.
 *
 * `isRegistered` false while `isEnabled` is true is the combination worth reading closely: it means
 * the tenant's status makes it ineligible (suspended/cancelled/deleted), not that an operator paused
 * the job.
 */
export interface PlatformTenantJob {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: TenantStatus;
  jobType: string;
  displayName: string;
  description: string;
  cronExpression: string;
  defaultCron: string;
  isEnabled: boolean;
  isRegistered: boolean;
  nextExecutionUtc: string | null;
  lastExecutionUtc: string | null;
  /** Hangfire's own state for the last triggered run ("Succeeded"/"Failed"/"Processing"). */
  hangfireLastJobState: string | null;
  lastRunAtUtc: string | null;
  lastRunOutcome: TenantJobRunOutcome | null;
  lastRunSummary: string | null;
  lastRunDurationMs: number | null;
  consecutiveFailureCount: number;
}

/** PlatformTenantJobsDto — every job for one tenant. `runsBackgroundJobs` is the tenant-level answer
 * to "why is nothing registered": false for a suspended/cancelled/deleted tenant regardless of any
 * individual job's own `isEnabled`. */
export interface PlatformTenantJobs {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: TenantStatus;
  runsBackgroundJobs: boolean;
  jobs: PlatformTenantJob[];
}

export interface PlatformJobQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  tenantId?: string;
  jobType?: string;
  isEnabled?: boolean;
  failingOnly?: boolean;
}

export interface UpdateTenantJobScheduleRequest {
  cronExpression: string;
  isEnabled: boolean;
}

/** PlatformJobTriggerResultDto. `backgroundJobId` is Hangfire's id for the one-off run, so an
 * operator can follow that exact execution in the Hangfire dashboard. */
export interface PlatformJobTriggerResult {
  recurringJobId: string;
  backgroundJobId: string;
}

/** PlatformGlobalJobDto — a recurring job that is platform-global rather than per-tenant (currently
 * just the tenant-job reconcile pass; the WhatsApp token refresh is per tenant). Read-only: there is no
 * tenant to scope a schedule edit to. */
export interface PlatformGlobalJob {
  recurringJobId: string;
  cronExpression: string | null;
  nextExecutionUtc: string | null;
  lastExecutionUtc: string | null;
  lastJobState: string | null;
  error: string | null;
}

/** TenantJobReconcileSummary — what one "Reconcile now" pass changed. */
export interface TenantJobReconcileSummary {
  tenantsExamined: number;
  schedulesCreated: number;
  jobsRegistered: number;
  jobsRemoved: number;
  orphanRegistrationsRemoved: number;
}
