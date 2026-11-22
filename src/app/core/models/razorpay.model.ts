/** RazorpaySettingsDto - the platform's Razorpay keys. Secrets never come back, only hints. */
export interface RazorpaySettings {
  keyId: string;
  mode: 'test' | 'live';
  hasKeySecret: boolean;
  keySecretHint: string | null;
  hasWebhookSecret: boolean;
  webhookSecretHint: string | null;
  isConfigured: boolean;
  /** Path of the webhook endpoint on the API, e.g. /api/v1/webhooks/razorpay. */
  webhookPath: string;
  /** Whether tenants billed in rupees pay for a plan through UPI AutoPay. */
  autoPayEnabled: boolean;
  /** On AND able to work: the keys and the webhook secret are saved. On but not ready means tenants still see the old buttons. */
  autoPayReady: boolean;
  /** How payments and orders are read: through Razorpay's MCP server, or the REST API. Creating orders, capture and refunds always use REST. */
  readTransport?: RazorpayReadTransport;
  /** Which key set new payments use. keyId, mode and the secret fields above describe this set. */
  activeMode?: RazorpayMode;
  testKeys?: RazorpayKeySet | null;
  liveKeys?: RazorpayKeySet | null;
}

export type RazorpayMode = 'test' | 'live';

/** One mode's saved keys, secrets masked. isComplete: key id, key secret and webhook secret are all saved. */
export interface RazorpayKeySet {
  mode: RazorpayMode;
  keyId: string;
  hasKeySecret: boolean;
  keySecretHint: string | null;
  hasWebhookSecret: boolean;
  webhookSecretHint: string | null;
  isConfigured: boolean;
  isComplete: boolean;
}

export type RazorpayReadTransport = 'Mcp' | 'Rest';

/** Secrets: null keeps the stored one, '' clears it, anything else replaces it. */
export interface UpdateRazorpaySettingsRequest {
  keyId: string;
  keySecret: string | null;
  webhookSecret: string | null;
  /** Which key set to save. The key id must carry that mode's prefix (rzp_test_ / rzp_live_). */
  mode?: RazorpayMode;
}

export interface RazorpayCheckResult {
  success: boolean;
  message: string;
}

/** amount is in rupees (major units). */
export interface CreateRazorpayOrderRequest {
  amount: number;
  currency: string;
  description: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerContact: string | null;
}

/** What Razorpay Checkout needs in the browser. amount is in paise. */
export interface RazorpayCheckout {
  id: string;
  orderId: string;
  keyId: string;
  mode: 'test' | 'live';
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string | null; email: string | null; contact: string | null };
}

export type RazorpayOrderStatus = 'Created' | 'Authorized' | 'Paid' | 'Failed' | 'PartiallyRefunded' | 'Refunded';

export interface RazorpayOrder {
  id: string;
  orderId: string;
  receipt: string;
  amountMinor: number;
  currency: string;
  description: string;
  status: RazorpayOrderStatus;
  mode: 'test' | 'live';
  paymentId: string | null;
  method: string | null;
  signatureVerifiedAtUtc: string | null;
  paidAtUtc: string | null;
  refundedMinor: number;
  lastRefundId: string | null;
  failureReason: string | null;
  lastWebhookEvent: string | null;
  lastWebhookAtUtc: string | null;
  createdAt: string;
}

export interface RazorpayStep {
  label: string;
  ok: boolean;
  detail: string | null;
}

export interface RazorpayVerifyResult {
  success: boolean;
  message: string;
  steps: RazorpayStep[];
  order: RazorpayOrder;
}

export interface RazorpayWebhookEvent {
  id: string;
  eventId: string;
  event: string;
  orderId: string | null;
  paymentId: string | null;
  applied: boolean;
  note: string | null;
  receivedAt: string;
}

/** What Checkout's success handler receives - passed to the server untouched. */
export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/** What Checkout's payment.failed event carries. */
export interface RazorpayFailureResponse {
  error: {
    code?: string;
    description?: string;
    reason?: string;
    source?: string;
    step?: string;
    metadata?: { payment_id?: string; order_id?: string };
  };
}

export const RAZORPAY_CURRENCIES = ['INR', 'USD'] as const;

/** "INR 1,234.50" from paise. */
export function formatMinor(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
