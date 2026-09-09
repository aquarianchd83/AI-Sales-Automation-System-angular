/** PlanDto — one row of the public plan catalog (GET /billing/plans, no auth required). */
export interface Plan {
  id: string;
  code: string;
  name: string;
  maxUsers: number;
  maxMessagesPerMonth: number;
  maxCampaigns: number;
  maxKnowledgeBaseArticles: number;
  priceMonthlyCents: number;
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
