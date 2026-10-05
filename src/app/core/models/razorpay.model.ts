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
}

/** Secrets: null keeps the stored one, '' clears it, anything else replaces it. */
export interface UpdateRazorpaySettingsRequest {
  keyId: string;
  keySecret: string | null;
  webhookSecret: string | null;
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
