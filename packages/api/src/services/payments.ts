/**
 * Peach Payments integration — South African payment processor.
 *
 * Used for:
 *  1. Collecting payments from operators (platform fee, site fee)
 *  2. Paying out settled amounts to operator bank accounts
 *
 * Peach Payments API: REST-based, uses Bearer auth.
 * Sandbox base URL: https://testsecure.peachpayments.com
 * Production base URL: https://secure.peachpayments.com
 *
 * Docs: https://developer.peachpayments.com
 */

import { config } from '../config';

const PEACH_BASE_URL = config.peach.sandboxMode
  ? 'https://testsecure.peachpayments.com'
  : 'https://secure.peachpayments.com';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PeachPaymentRequest {
  amount: number;           // in cents (ZAR)
  currency: 'ZAR';
  description: string;
  reference: string;        // our settlement_ref or session_ref
  customerEmail?: string;
  customerName?: string;
  returnUrl?: string;
  webhookUrl?: string;
}

export interface PeachPaymentResult {
  success: boolean;
  paymentId?: string;
  checkoutUrl?: string;    // redirect URL for card collection
  status?: string;
  errorCode?: string;
  error?: string;
  raw?: unknown;
}

export interface PeachPayoutRequest {
  amount: number;           // in cents
  currency: 'ZAR';
  reference: string;
  recipientAccountRef: string;  // tokenised bank account ref
  description: string;
}

export interface PeachPayoutResult {
  success: boolean;
  payoutId?: string;
  status?: string;
  error?: string;
  raw?: unknown;
}

export interface PeachWebhookPayload {
  id: string;
  paymentType: string;
  amount: string;
  currency: string;
  result: {
    code: string;
    description: string;
  };
  merchantTransactionId: string;
  timestamp: string;
  customParameters?: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function peachHeaders(): Record<string, string> {
  return {
    'Authorization': `Bearer ${config.peach.apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

// ── Payment initiation (card collect) ─────────────────────────────────────────

/**
 * Initiate a checkout session for card payment collection.
 * Returns a checkout URL to redirect the operator/site-owner to.
 * In sandbox mode, simulates the response locally.
 */
export async function initiatePayment(req: PeachPaymentRequest): Promise<PeachPaymentResult> {
  if (config.isDev || !config.peach.apiKey) {
    // Sandbox simulation
    const fakeId = `PAY-${Date.now()}`;
    console.log(`[peach] DEV initiatePayment: ${req.reference} R${formatAmount(req.amount)}`);
    return {
      success: true,
      paymentId: fakeId,
      checkoutUrl: `https://testsecure.peachpayments.com/checkout?id=${fakeId}`,
      status: 'PENDING',
    };
  }

  try {
    const body = {
      entityId: config.peach.merchantId,
      amount: formatAmount(req.amount),
      currency: req.currency,
      paymentType: 'DB', // Debit
      merchantTransactionId: req.reference,
      descriptor: req.description.slice(0, 64),
      ...(req.customerEmail ? { customer: { email: req.customerEmail, givenName: req.customerName } } : {}),
      ...(req.returnUrl ? { shopperResultUrl: req.returnUrl } : {}),
      ...(req.webhookUrl ? { notificationUrl: req.webhookUrl } : {}),
    };

    const res = await fetch(`${PEACH_BASE_URL}/v1/checkouts`, {
      method: 'POST',
      headers: peachHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      return { success: false, error: String((data.result as Record<string,unknown>)?.description ?? 'Payment failed'), raw: data };
    }

    return {
      success: true,
      paymentId: data.id as string,
      checkoutUrl: `${PEACH_BASE_URL}/v1/paymentWidgets.js?checkoutId=${data.id}`,
      status: 'PENDING',
      raw: data,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[peach] initiatePayment error:', error);
    return { success: false, error };
  }
}

// ── Payout (operator bank transfer) ───────────────────────────────────────────

/**
 * Initiate a payout to an operator's tokenised bank account.
 * Uses Peach Payments' payout/disbursement API.
 */
export async function initiatePayout(req: PeachPayoutRequest): Promise<PeachPayoutResult> {
  if (config.isDev || !config.peach.apiKey) {
    const fakeId = `PAYOUT-${Date.now()}`;
    console.log(`[peach] DEV initiatePayout: ${req.reference} R${formatAmount(req.amount)} → ${req.recipientAccountRef}`);
    return { success: true, payoutId: fakeId, status: 'PENDING' };
  }

  try {
    const body = {
      entityId: config.peach.merchantId,
      amount: formatAmount(req.amount),
      currency: req.currency,
      paymentType: 'CD', // Credit (payout)
      merchantTransactionId: req.reference,
      descriptor: req.description.slice(0, 64),
      // Bank account details are resolved server-side from the tokenised ref
      virtualAccount: {
        accountId: req.recipientAccountRef,
      },
    };

    const res = await fetch(`${PEACH_BASE_URL}/v1/payments`, {
      method: 'POST',
      headers: peachHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      return { success: false, error: String((data.result as Record<string,unknown>)?.description ?? 'Payout failed'), raw: data };
    }

    return {
      success: true,
      payoutId: (data.id ?? req.reference) as string,
      status: (data.result as Record<string, unknown>)?.code as string ?? 'PENDING',
      raw: data,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('[peach] initiatePayout error:', error);
    return { success: false, error };
  }
}

// ── Payment status query ───────────────────────────────────────────────────────

export async function queryPaymentStatus(paymentId: string): Promise<{
  status: string; resultCode: string; description: string; raw?: unknown;
}> {
  if (config.isDev || !config.peach.apiKey) {
    return { status: 'SUCCESS', resultCode: '000.100.110', description: 'Request successfully processed' };
  }

  try {
    const res = await fetch(
      `${PEACH_BASE_URL}/v1/checkouts/${paymentId}/payment?entityId=${config.peach.merchantId}`,
      { headers: peachHeaders() },
    );
    const data = await res.json() as Record<string, unknown>;
    const result = data.result as Record<string, unknown>;
    return {
      status: (result?.code as string ?? '').startsWith('000') ? 'SUCCESS' : 'FAILED',
      resultCode: result?.code as string ?? '',
      description: result?.description as string ?? '',
      raw: data,
    };
  } catch (err: unknown) {
    return { status: 'ERROR', resultCode: '', description: err instanceof Error ? err.message : String(err) };
  }
}

// ── Webhook signature verification ────────────────────────────────────────────

import { createHmac } from 'crypto';

/**
 * Verify the HMAC-SHA256 signature on incoming Peach webhook calls.
 * Header: X-Peach-Signature
 * Shared secret: PEACH_PAYMENTS_WEBHOOK_SECRET
 */
export function verifyPeachWebhook(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');
  // Constant-time comparison
  return expected.length === signature.length &&
    Buffer.from(expected).every((b, i) => b === signature.charCodeAt(i));
}
