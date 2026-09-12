/** PlanDto — one row of the public plan catalog (GET /billing/plans, no auth required).
 * priceMonthlyCents stays the base USD list price; currencyCode/currencySymbol/localPriceAmount are
 * a display/quote figure resolved server-side from the caller's country (an authenticated tenant's
 * own stored country, or an anonymous caller's ?country= query param). */
export interface Plan {
  id: string;
  code: string;
  name: string;
  maxUsers: number;
  maxMessagesPerMonth: number;
  maxCampaigns: number;
  maxKnowledgeBaseArticles: number;
  priceMonthlyCents: number;
  currencyCode: string;
  currencySymbol: string;
  localPriceAmount: number;
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
}
