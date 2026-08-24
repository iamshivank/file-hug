import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from '@/features/auth/oauth';

const STATE_COOKIE = 'fh_oauth_state';
const PLAN_COOKIE = 'fh_auth_plan';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = new URL(request.url).origin;
  const requestedPlan = new URL(request.url).searchParams.get('plan');
  const plan = requestedPlan === 'pro' || requestedPlan === 'ai' ? requestedPlan : null;

  // When Google OAuth is not configured, fall back to a demo session.
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL(plan ? `/api/auth/demo?plan=${plan}` : '/api/auth/demo', origin));
  }

  const state = crypto.randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });
  if (plan) {
    cookieStore.set(PLAN_COOKIE, plan, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10,
    });
  } else {
    cookieStore.delete(PLAN_COOKIE);
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  return NextResponse.redirect(getGoogleAuthUrl(state, redirectUri));
}
