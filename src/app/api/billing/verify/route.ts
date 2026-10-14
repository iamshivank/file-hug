import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSession } from '@/features/auth/session';
import { fetchOrder, verifyPaymentSignature } from '@/features/billing/razorpay';
import { activateSubscription } from '@/features/billing/subscriptionWrite';
import { PLANS } from '@/features/billing/plans';

/**
 * Client-side confirmation path after Razorpay checkout resolves. This is a UX
 * convenience — the webhook is the source of truth — but it lets us reflect the
 * new plan immediately after a successful payment.
 *
 * The payment signature only covers `orderId|paymentId`, so nothing else in the
 * body can be trusted: the plan (and the account it was bought for) are read
 * from the order itself, which our server created with those values in `notes`.
 * Otherwise a ₹99 Pro payment could be "verified" as the ₹199 AI plan, or one
 * user's payment replayed onto another account.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'You must be signed in.' },
      { status: 401 }
    );
  }

  let body: { orderId?: unknown; paymentId?: unknown; signature?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const { orderId, paymentId, signature } = body ?? {};
  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' ||
      !orderId || !paymentId || !signature) {
    return NextResponse.json(
      { success: false, error: 'Missing or invalid payment details.' },
      { status: 400 }
    );
  }

  const valid = verifyPaymentSignature({ orderId, paymentId, signature });
  if (!valid) {
    return NextResponse.json(
      { success: false, error: 'Payment verification failed.' },
      { status: 400 }
    );
  }

  let order;
  try {
    order = await fetchOrder(orderId);
  } catch (err) {
    console.error('[billing/verify] order lookup failed:', err);
    // The payment is genuine; the webhook will still activate the plan.
    return NextResponse.json(
      { success: false, error: 'Payment received — your plan will update shortly.' },
      { status: 502 }
    );
  }

  const plan = order.notes.plan;
  if (order.notes.userId !== session.user.id || (plan !== 'pro' && plan !== 'ai')) {
    return NextResponse.json(
      { success: false, error: 'Payment verification failed.' },
      { status: 403 }
    );
  }
  if (order.amount !== PLANS[plan].priceInr * 100) {
    console.error(`[billing/verify] order ${orderId} amount ${order.amount} does not match plan ${plan}`);
    return NextResponse.json(
      { success: false, error: 'Payment verification failed.' },
      { status: 400 }
    );
  }

  // Best-effort persistence (no-ops in demo / no-DB).
  await activateSubscription({
    userId: session.user.id,
    plan,
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  });

  return NextResponse.json({ success: true });
}
