import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/features/auth/password';
import { createSession, type SessionUser } from '@/features/auth/session';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { success: false, error: 'Email sign-up is unavailable — no database is configured.' },
      { status: 503 }
    );
  }

  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name || name.length > 200) {
    return NextResponse.json(
      { success: false, error: 'Name is required (max 200 characters).' },
      { status: 400 }
    );
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { success: false, error: 'Please enter a valid email address.' },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { success: false, error: 'Password must be at least 8 characters.' },
      { status: 400 }
    );
  }

  try {
    const { db } = await import('@/lib/db');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists. Try signing in.' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const [inserted] = await db
      .insert(users)
      .values({ email, name, passwordHash, isDemo: false })
      .returning({ id: users.id });

    if (!inserted) {
      throw new Error('Insert returned no row');
    }

    const user: SessionUser = {
      id: inserted.id,
      name,
      email,
      image: null,
      isDemo: false,
    };
    await createSession(user);

    return NextResponse.json({ success: true, data: { user } }, { status: 201 });
  } catch (error) {
    console.error('[auth] Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
