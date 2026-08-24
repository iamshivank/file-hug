import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/features/auth/password';
import { createSession, type SessionUser } from '@/features/auth/session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { success: false, error: 'Email sign-in is unavailable because no database is configured.' },
      { status: 503 }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ success: false, error: 'Email and password are required.' }, { status: 400 });
  }

  try {
    const { db } = await import('@/lib/db');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!found || !found.passwordHash || !(await verifyPassword(password, found.passwordHash))) {
      const error = found && !found.passwordHash
        ? 'This account uses Google sign-in. Continue with Google instead.'
        : 'Invalid email or password.';
      return NextResponse.json({ success: false, error }, { status: 401 });
    }

    const user: SessionUser = {
      id: found.id,
      name: found.name,
      email: found.email,
      image: found.image ?? null,
      isDemo: false,
    };
    await createSession(user);
    return NextResponse.json({ success: true, data: { user } });
  } catch (error) {
    console.error('[auth] Login error:', error);
    return NextResponse.json({ success: false, error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
