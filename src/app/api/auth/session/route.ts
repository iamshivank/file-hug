import { NextResponse } from 'next/server';
import { getSession, renewSession } from '@/features/auth/session';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  // The app shell calls this on load, which makes it the natural place to keep
  // an active user's sign-in from ever lapsing (cookies can't be set while a
  // server component renders).
  if (session) await renewSession();
  return NextResponse.json({ user: session?.user ?? null });
}
