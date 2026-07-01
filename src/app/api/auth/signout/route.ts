import { NextResponse } from 'next/server';
import { destroySession } from '@/features/auth/session';

export async function POST(): Promise<NextResponse> {
  await destroySession();
  return NextResponse.json({ success: true });
}
