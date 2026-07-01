import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeGoogleCode, type GoogleProfile } from '@/features/auth/oauth';
import { createSession, type SessionUser } from '@/features/auth/session';

const STATE_COOKIE = 'fh_oauth_state';

/**
 * Upsert the Google user into the `users` table when a DB is configured.
 * Returns the persisted user id, or null when no DB is available (or on error),
 * in which case the caller falls back to the Google subject id.
 */
async function upsertUser(profile: GoogleProfile): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import('@/lib/db');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const existing = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db
        .update(users)
        .set({ name: profile.name, image: profile.image ?? null, googleId: profile.id })
        .where(eq(users.email, profile.email))
        .returning({ id: users.id });
      return updated?.id ?? existing[0].id;
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
    return inserted?.id ?? null;
  } catch (error) {
    console.error('[auth] Failed to upsert Google user:', error);
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  // Clear the one-time state cookie regardless of outcome.
  cookieStore.delete(STATE_COOKIE);

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
    return NextResponse.redirect(new URL('/app', origin));
  } catch (error) {
    console.error('[auth] Google callback error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth', origin));
  }
}
