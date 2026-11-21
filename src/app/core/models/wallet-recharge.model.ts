/** Wallet top-up through Razorpay. Money is in rupees (major units); the wallet itself holds credits. */

export interface RechargeOptions {
  currency: string;
  minAmount: number;
  maxAmount: number;
  creditsPerRupee: number;
  presets: number[];
  /** The wallet balance in credits, before any payment. */
  balance: number;
}

export interface TaxLine {
  name: string;
  ratePercent: number;
  amount: number;
}

/** What an amount costs - priced by the server, never by the browser. */
export interface RechargeQuote {
  amount: number;
  tax: number;
  total: number;
  currency: string;
  taxLines: TaxLine[];
  credits: number;
  balanceBefore: number;
  balanceAfter: number;
}

export interface RechargeCheckout {
  transactionId: string;
  reference: string;
  orderId: string;
  keyId: string;
  mode: 'test' | 'live';
  amountMinor: number;
  currency: string;
  businessName: string;
  description: string;
  amount: number;
  tax: number;
  total: number;
  credits: number;
  prefill: { name: string | null; email: string | null; contact: string | null };
}

export type RechargeStatus = 'Created' | 'Authorized' | 'Credited' | 'Failed' | 'Expired' | 'PartiallyRefunded' | 'Refunded';

export interface RechargeTransaction {
  id: string;
  reference: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  amount: number;
  tax: number;
  total: number;
  currency: string;
  credits: number;
  status: RechargeStatus;
  paymentMethod: string | null;
  failureReason: string | null;
  mode: string;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
  capturedAt: string | null;
  creditedAt: string | null;
}

export interface RechargeVerifyResult {
  success: boolean;
  /** Genuine but not confirmed yet - the webhook or reconciliation settles it. */
  pending: boolean;
  message: string;
  transaction: RechargeTransaction | null;
  balance: number | null;
}

/** What Checkout's success handler gives us, in Razorpay's own field names. */
export interface VerifyRechargeRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const RECHARGE_STATUS_LABELS: Record<RechargeStatus, string> = {
  Created: 'Awaiting payment',
  Authorized: 'Processing',
  Credited: 'Credited',
  Failed: 'Failed',
  Expired: 'Not completed',
  PartiallyRefunded: 'Partly refunded',
  Refunded: 'Refunded',
};

/** A top-up the server has not settled yet: worth asking about again. */
export function isRechargePending(status: RechargeStatus): boolean {
  return status === 'Created' || status === 'Authorized';
}

/** "₹1,234.50" - rupees always show paise when there are any. */
export function formatRupees(amount: number): string {
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
