import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSession } from '@/features/auth/session';
import { createOrder, isRazorpayConfigured } from '@/features/billing/razorpay';
import { recordPendingOrder } from '@/features/billing/subscriptionWrite';

/** Paid plan → amount in paise. Keep in sync with `@/features/billing/plans`. */
const PLAN_AMOUNTS: Record<'pro' | 'ai', number> = {
  pro: 9900, // ₹99
  ai: 19900, // ₹199
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'You must be signed in to upgrade.' },
      { status: 401 }
    );
  }

  let body: { plan?: string };
  try {
    body = (await request.json()) as { plan?: string };
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const plan = body.plan;
  if (plan !== 'pro' && plan !== 'ai') {
    return NextResponse.json(
      { success: false, error: 'Choose a valid paid plan (pro or ai).' },
      { status: 400 }
    );
  }

  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Payments not configured.' },
      { status: 503 }
    );
  }

  // Real keys are present — block demo accounts from attempting a real payment.
  if (session.user.isDemo) {
    return NextResponse.json(
      { success: false, error: 'Sign in with a real account to upgrade.' },
      { status: 403 }
    );
  }

  const amount = PLAN_AMOUNTS[plan];
  const receipt = `fh_${plan}_${session.user.id}_${Date.now()}`.slice(0, 40);

  try {
    const order = await createOrder(amount, receipt, {
      userId: session.user.id,
      plan,
    });

    // Best-effort: persist a pending row so the webhook can resolve the user.
    await recordPendingOrder({
      userId: session.user.id,
      plan,
      razorpayOrderId: order.id,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      plan,
    });
  } catch (err) {
    console.error('[billing/order] failed:', err);
    return NextResponse.json(
      { success: false, error: 'Could not start checkout. Please try again.' },
      { status: 502 }
    );
  }
}
