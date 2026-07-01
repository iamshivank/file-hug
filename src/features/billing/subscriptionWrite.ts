import 'server-only';

import type { PlanId } from '@/features/billing/plans';

/**
 * Subscription write helpers. Owned by the billing agent — the reader lives in
 * `@/features/billing/subscription` and must not be edited here.
 *
 * Every write is guarded so it no-ops gracefully when there is no database
 * (DEMO mode / missing DATABASE_URL). Importing `@/lib/db` throws at module load
 * when DATABASE_URL is absent, so we import it lazily inside a try/catch and
 * never let a failure bubble up to the request.
 */

const DEMO_MODE = process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true';

function hasDatabase(): boolean {
  return !DEMO_MODE && Boolean(process.env.DATABASE_URL);
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface PendingOrderInput {
  userId: string;
  plan: PlanId;
  razorpayOrderId: string;
}

export interface ActivateInput {
  userId: string;
  plan: PlanId;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}

/**
 * Record a pending subscription row (or update an existing one) when an order
 * is created. Best-effort: returns false and logs on any failure.
 */
export async function recordPendingOrder(input: PendingOrderInput): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    const { db } = await import('@/lib/db');
    const { subscriptions } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const now = new Date();

    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, input.userId))
      .limit(1);

    // The subscription status enum is ['active','canceled','past_due'] — there
    // is no dedicated "pending" value, so an unpaid order is recorded as
    // 'past_due'. Entitlements (`getUserPlan`) only unlock on status 'active',
    // so this row grants nothing until the webhook/verify flow activates it.
    // For an already-active subscriber we only stash the pending orderId and
    // leave their current active plan untouched until payment is confirmed.
    if (existing.length > 0) {
      const current = existing[0];
      await db
        .update(subscriptions)
        .set({
          plan: current.status === 'active' ? current.plan : input.plan,
          status: current.status === 'active' ? 'active' : 'past_due',
          razorpayOrderId: input.razorpayOrderId,
          updatedAt: now,
        })
        .where(eq(subscriptions.userId, input.userId));
    } else {
      await db.insert(subscriptions).values({
        userId: input.userId,
        plan: input.plan,
        status: 'past_due',
        razorpayOrderId: input.razorpayOrderId,
        createdAt: now,
        updatedAt: now,
      });
    }
    return true;
  } catch (err) {
    console.error('[billing] recordPendingOrder failed:', err);
    return false;
  }
}

/**
 * Activate a subscription for a user (upsert to `active` with a ~30-day period).
 * Used by both the client verify route and the webhook. Best-effort.
 */
export async function activateSubscription(input: ActivateInput): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    const { db } = await import('@/lib/db');
    const { subscriptions } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const now = new Date();
    const currentPeriodEnd = new Date(now.getTime() + THIRTY_DAYS_MS);

    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, input.userId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(subscriptions)
        .set({
          plan: input.plan,
          status: 'active',
          razorpayOrderId: input.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          currentPeriodEnd,
          updatedAt: now,
        })
        .where(eq(subscriptions.userId, input.userId));
    } else {
      await db.insert(subscriptions).values({
        userId: input.userId,
        plan: input.plan,
        status: 'active',
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        currentPeriodEnd,
        createdAt: now,
        updatedAt: now,
      });
    }
    return true;
  } catch (err) {
    console.error('[billing] activateSubscription failed:', err);
    return false;
  }
}

/**
 * Resolve the userId associated with a Razorpay order id. Used by the webhook,
 * whose payload references the order rather than the session. Returns null when
 * unavailable (no DB, unknown order, or on error).
 */
export async function findUserIdByOrderId(orderId: string): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    const { db } = await import('@/lib/db');
    const { subscriptions } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.razorpayOrderId, orderId))
      .limit(1);
    return rows[0]?.userId ?? null;
  } catch (err) {
    console.error('[billing] findUserIdByOrderId failed:', err);
    return null;
  }
}
