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
}

// ---------------------------------------------------------------------------
// Billing (GET /platform/billing/*)
// ---------------------------------------------------------------------------

/** PlatformPlanDto — the platform-only view of the catalog (includes inactive plans and the
 * Stripe price id, unlike the tenant-facing PlanDto used by /billing/plans). */
export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
  stripePriceId: string | null;
  maxUsers: number;
  maxMessagesPerMonth: number;
  maxCampaigns: number;
  maxKnowledgeBaseArticles: number;
  priceMonthlyCents: number;
  isActive: boolean;
}

export interface PlatformSubscriptionQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: SubscriptionStatus;
}

/** PlatformSubscriptionListItemDto. hasFailedPayment is derived from Status === PastDue — this
 * system keeps no local invoice ledger, so it is not a per-invoice history. */
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
 * applies — never rendered as a breach. */
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
