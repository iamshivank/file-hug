import type { PlanId } from './plans';

/**
 * Read a user's active plan. Returns 'free' when in demo mode, when no DB is
 * configured, when the user has no active subscription, or on any error.
 */
export async function getUserPlan(userId: string): Promise<PlanId> {
  if (process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true') return 'free';
  if (!process.env.DATABASE_URL) return 'free';
  if (!userId) return 'free';

  try {
    const { db } = await import('@/lib/db');
    const { subscriptions } = await import('@/db/schema');
    const { eq, and, or, isNull, gt, desc } = await import('drizzle-orm');

    // Paid plans are one-off monthly orders, not auto-renewing subscriptions, so
    // an `active` row only entitles the user until `currentPeriodEnd`. Without
    // this check a single ₹99 payment unlocked the plan forever. A null period
    // end (a manually granted plan) never expires.
    const rows = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, 'active'),
          or(isNull(subscriptions.currentPeriodEnd), gt(subscriptions.currentPeriodEnd, new Date()))
        )
      )
      .orderBy(desc(subscriptions.updatedAt))
      .limit(1);

    return (rows[0]?.plan as PlanId | undefined) ?? 'free';
  } catch (error) {
    console.error('[billing] getUserPlan failed:', error);
    return 'free';
  }
}
