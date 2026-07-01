import { NextRequest, NextResponse } from 'next/server';
import { createSession, type SessionUser } from '@/features/auth/session';

const DEMO_USER: SessionUser = {
  id: 'demo-user',
  name: 'Demo User',
  email: 'demo@filehug.app',
  image: null,
  isDemo: true,
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  await createSession(DEMO_USER);
  return NextResponse.redirect(new URL('/app', request.url));
}

export async function POST(): Promise<NextResponse> {
  await createSession(DEMO_USER);
  return NextResponse.json({ success: true });
}
