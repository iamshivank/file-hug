import { NextResponse } from 'next/server';
import { getSession } from '@/features/auth/session';

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  return NextResponse.json({ user: session?.user ?? null });
}
