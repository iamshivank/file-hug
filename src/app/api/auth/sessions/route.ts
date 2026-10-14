import { NextRequest, NextResponse } from 'next/server';
import { destroySession, getCurrentSessionId, getSession } from '@/features/auth/session';
import { listSessions, revokeOtherSessions, revokeSession } from '@/features/auth/sessionStore';
import { describeUserAgent } from '@/features/auth/userAgent';

/** The signed-in user's active devices. Demo sessions have none to manage. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session || session.user.isDemo) {
    return NextResponse.json({ success: false, error: 'You must be signed in.' }, { status: 401 });
  }

  const rows = await listSessions(session.user.id);
  if (rows === null) {
    return NextResponse.json(
      { success: false, error: 'Device management is unavailable right now.' },
      { status: 503 }
    );
  }

  const currentId = await getCurrentSessionId();
  return NextResponse.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      device: describeUserAgent(row.userAgent),
      ip: row.ip,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      current: row.id === currentId,
    })),
  });
}

/**
 * Sign out a device. Body: `{ id }` for one session, or `{ scope: 'others' }`
 * for every device except this one. Revoking the current session signs this
 * browser out too.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session || session.user.isDemo) {
    return NextResponse.json({ success: false, error: 'You must be signed in.' }, { status: 401 });
  }

  let body: { id?: unknown; scope?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const currentId = await getCurrentSessionId();

  if (body?.scope === 'others') {
    const revoked = await revokeOtherSessions(session.user.id, currentId);
    if (revoked === null) {
      return NextResponse.json(
        { success: false, error: 'Could not sign out other devices. Please try again.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: true, data: { revoked } });
  }

  if (typeof body?.id !== 'string' || !body.id) {
    return NextResponse.json({ success: false, error: 'Missing session id.' }, { status: 400 });
  }

  if (body.id === currentId) {
    await destroySession();
    return NextResponse.json({ success: true, data: { revoked: 1, signedOut: true } });
  }

  const ok = await revokeSession(session.user.id, body.id);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'That device is already signed out.' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { revoked: 1 } });
}
