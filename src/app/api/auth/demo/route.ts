import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSession, type SessionUser } from '@/features/auth/session';

const DEMO_USER: SessionUser = {
  id: 'demo-user',
  name: 'Demo User',
  email: 'demo@filehug.app',
  image: null,
  isDemo: true,
};

/**
 * Start a demo session — unless the browser is already signed in to a real
 * account. GET is reachable by any top-level link (SameSite=Lax cookies ride
 * along and Set-Cookie is honoured), so without this check another site could
 * silently swap a signed-in user's session for the demo one.
 */
async function ensureDemoSession(): Promise<void> {
  const session = await getSession();
  if (session && !session.user.isDemo) return;
  await createSession(DEMO_USER);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  await ensureDemoSession();
  const requested = new URL(request.url).searchParams.get('plan');
  const destination = requested === 'pro' || requested === 'ai'
    ? `/app/profile?plan=${requested}`
    : '/app';
  return NextResponse.redirect(new URL(destination, request.url));
}

export async function POST(): Promise<NextResponse> {
  await ensureDemoSession();
  return NextResponse.json({ success: true });
}
