import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { getSession } from '@/features/auth/session';
import { verifyPaymentSignature } from '@/features/billing/razorpay';
import { activateSubscription } from '@/features/billing/subscriptionWrite';

/**
 * Client-side confirmation path after Razorpay checkout resolves. This is a UX
 * convenience — the webhook is the source of truth — but it lets us reflect the
 * new plan immediately after a successful payment.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'You must be signed in.' },
      { status: 401 }
    );
  }

  let body: { orderId?: string; paymentId?: string; signature?: string; plan?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const { orderId, paymentId, signature, plan } = body;
  if (!orderId || !paymentId || !signature || (plan !== 'pro' && plan !== 'ai')) {
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

  // Best-effort persistence (no-ops in demo / no-DB).
  await activateSubscription({
    userId: session.user.id,
    plan,
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
  });

  return NextResponse.json({ success: true });
}
