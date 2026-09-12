/** PlanDto — one row of the public plan catalog (GET /billing/plans, no auth required).
 * priceMonthlyCents stays the base USD price Stripe actually charges; currencyCode/currencySymbol/
 * localPriceAmount are a display/quote figure resolved server-side from the caller's country (an
 * authenticated tenant's own stored country, or an anonymous caller's ?country= query param) - not
 * what Stripe bills. */
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
 * the tenant has never completed Checkout (still on its signup trial). */
export interface Subscription {
  planId: string | null;
  planName: string | null;
  status: string;
  currentPeriodEndUtc: string | null;
}

export interface CreateCheckoutSessionRequest {
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateBillingPortalSessionRequest {
  returnUrl: string;
}

/** BillingSessionUrlDto — a Stripe-hosted URL to redirect the browser to (Checkout or the
 * Billing Portal); this panel never renders either page itself. */
export interface BillingSessionUrl {
  url: string;
}
