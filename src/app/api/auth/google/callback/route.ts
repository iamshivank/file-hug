import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeGoogleCode, type GoogleProfile } from '@/features/auth/oauth';
import { createSession, type SessionUser } from '@/features/auth/session';

const STATE_COOKIE = 'fh_oauth_state';
const PLAN_COOKIE = 'fh_auth_plan';

/**
 * Upsert the Google user into the `users` table when a DB is configured.
 * Returns the persisted user id, or null when no DB is configured, in which case
 * the caller falls back to the Google subject id.
 *
 * Throws when a DB IS configured but the write fails: falling back to the Google
 * subject id there would mint a session for an id with no `users` row, whose
 * saves land under an id the account will never see again once the DB recovers.
 */
async function upsertUser(profile: GoogleProfile): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  const { db } = await import('@/lib/db');
  const { users } = await import('@/db/schema');
  const { eq, sql } = await import('drizzle-orm');

  // Case-insensitive, so an address stored before emails were lower-cased still
  // resolves to the same account.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${profile.email}`)
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(users)
      .set({ name: profile.name, image: profile.image ?? null, googleId: profile.id })
      .where(eq(users.id, existing[0].id));
    return existing[0].id;
  }

  const [inserted] = await db
    .insert(users)
    .values({
      email: profile.email,
      name: profile.name,
      image: profile.image ?? null,
      googleId: profile.id,
      isDemo: false,
    })
    .returning({ id: users.id });
  if (!inserted) throw new Error('Insert returned no row');
  return inserted.id;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  const requestedPlan = cookieStore.get(PLAN_COOKIE)?.value;
  // Clear the one-time state cookie regardless of outcome.
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(PLAN_COOKIE);

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/login?error=oauth', origin));
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const profile = await exchangeGoogleCode(code, redirectUri);

    const persistedId = await upsertUser(profile);

    const user: SessionUser = {
      id: persistedId ?? profile.id,
      name: profile.name,
      email: profile.email,
      image: profile.image ?? null,
      isDemo: false,
    };

    await createSession(user);
    const destination = requestedPlan === 'pro' || requestedPlan === 'ai'
      ? `/app/profile?plan=${requestedPlan}`
      : '/app';
    return NextResponse.redirect(new URL(destination, origin));
  } catch (error) {
    console.error('[auth] Google callback error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth', origin));
  }
}
