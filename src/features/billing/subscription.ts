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
    const { eq, and } = await import('drizzle-orm');

    const rows = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, 'active')))
      .limit(1);

    return (rows[0]?.plan as PlanId | undefined) ?? 'free';
  } catch (error) {
    console.error('[billing] getUserPlan failed:', error);
    return 'free';
  }
}
