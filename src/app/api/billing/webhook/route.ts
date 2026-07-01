import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { verifyWebhookSignature } from '@/features/billing/razorpay';
import { activateSubscription, findUserIdByOrderId } from '@/features/billing/subscriptionWrite';
import type { PlanId } from '@/features/billing/plans';

/**
 * Razorpay webhook — the source of truth for subscription state.
 *
 * We must read the RAW request body (via `request.text()`) to verify the
 * `x-razorpay-signature` HMAC; parsing to JSON first would change the bytes and
 * break signature verification. Return 200 quickly on success, 400 on a bad
 * signature.
 */

interface RazorpayEntity {
  order_id?: string;
  id?: string;
  notes?: Record<string, string>;
}

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayEntity };
    order?: { entity?: RazorpayEntity };
  };
}

function isPlanId(value: unknown): value is Exclude<PlanId, 'free'> {
  return value === 'pro' || value === 'ai';
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ success: false, error: 'Invalid signature.' }, { status: 400 });
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid payload.' }, { status: 400 });
  }

  const type = event.event;
  if (type !== 'payment.captured' && type !== 'order.paid') {
    // Acknowledge unrelated events so Razorpay stops retrying.
    return NextResponse.json({ success: true, ignored: true });
  }

  const paymentEntity = event.payload?.payment?.entity;
  const orderEntity = event.payload?.order?.entity;

  const orderId = paymentEntity?.order_id ?? orderEntity?.id;
  const paymentId = paymentEntity?.id ?? '';
  const notes = paymentEntity?.notes ?? orderEntity?.notes ?? {};

  if (!orderId) {
    // Nothing to reconcile against — acknowledge to avoid retries.
    return NextResponse.json({ success: true, ignored: true });
  }

  // Prefer the userId from the order notes; fall back to the stored order row.
  const notesUserId = typeof notes.userId === 'string' ? notes.userId : null;
  const userId = notesUserId ?? (await findUserIdByOrderId(orderId));
  const plan = isPlanId(notes.plan) ? notes.plan : null;

  if (userId && plan) {
    await activateSubscription({
      userId,
      plan,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
    });
  }

  // Always 200 once the signature is valid so Razorpay marks it delivered.
  return NextResponse.json({ success: true });
}
