import 'server-only';

import crypto from 'node:crypto';

/**
 * Razorpay integration via the REST API + hosted checkout — no SDK dependency.
 * All functions read credentials from the environment at call time so that a
 * missing configuration degrades gracefully (see `isRazorpayConfigured`).
 */

const ORDERS_ENDPOINT = 'https://api.razorpay.com/v1/orders';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt?: string;
  status?: string;
}

/** True only when BOTH the key id and secret are present in the environment. */
export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function basicAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID ?? '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

/**
 * Create an order on Razorpay. Amount is in the smallest currency unit (paise).
 * Throws when Razorpay is not configured or the API responds with an error.
 */
export async function createOrder(
  amountInPaise: number,
  receipt: string,
  notes: Record<string, string>
): Promise<RazorpayOrder> {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay is not configured.');
  }

  const res = await fetch(ORDERS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes,
    }),
    // Never cache a mutating billing call.
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Razorpay order creation failed (${res.status}): ${detail}`);
  }

  const order = (await res.json()) as RazorpayOrder;
  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt,
    status: order.status,
  };
}

/** Constant-time comparison of two hex/ascii signature strings. */
function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify the checkout handshake signature returned to the client after payment.
 * Razorpay signs `${orderId}|${paymentId}` with the key secret (HMAC-SHA256).
 */
export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}

/**
 * Verify a Razorpay webhook. The signature is an HMAC-SHA256 of the RAW request
 * body using the dedicated webhook secret (distinct from the key secret).
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
