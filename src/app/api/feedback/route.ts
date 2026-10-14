import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/auth/session';
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MIN_LENGTH,
  type FeedbackKind,
} from '@/features/feedback/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(['landing', 'app']);

/** Store a piece of feedback. Anonymous is fine; signed-in users are attributed. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true' || !process.env.DATABASE_URL) {
    return NextResponse.json(
      { success: false, error: "Feedback isn't being collected on this deployment." },
      { status: 503 }
    );
  }

  let body: { kind?: unknown; message?: unknown; email?: unknown; source?: unknown; website?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  // Honeypot: a field real users never see. Pretend success so bots move on.
  if (typeof body?.website === 'string' && body.website.trim()) {
    return NextResponse.json({ success: true }, { status: 201 });
  }

  const kind: FeedbackKind = FEEDBACK_KINDS.includes(body?.kind as FeedbackKind)
    ? (body.kind as FeedbackKind)
    : 'other';

  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (message.length < FEEDBACK_MIN_LENGTH) {
    return NextResponse.json({ success: false, error: 'Please tell us a little more.' }, { status: 400 });
  }
  if (message.length > FEEDBACK_MAX_LENGTH) {
    return NextResponse.json(
      { success: false, error: `Please keep it under ${FEEDBACK_MAX_LENGTH.toLocaleString()} characters.` },
      { status: 400 }
    );
  }

  const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (rawEmail && (rawEmail.length > 255 || !EMAIL_RE.test(rawEmail))) {
    return NextResponse.json({ success: false, error: "That email doesn't look right." }, { status: 400 });
  }

  const session = await getSession();
  const user = session && !session.user.isDemo ? session.user : null;
  const source = typeof body?.source === 'string' && SOURCES.has(body.source) ? body.source : null;

  try {
    const { db } = await import('@/lib/db');
    const { feedback } = await import('@/db/schema');
    await db.insert(feedback).values({
      userId: user?.id ?? null,
      email: rawEmail || user?.email || null,
      kind,
      message,
      source,
      userAgent: request.headers.get('user-agent')?.slice(0, 512) ?? null,
    });
  } catch (error) {
    console.error('[feedback] could not store feedback:', error);
    return NextResponse.json(
      { success: false, error: "Couldn't send your feedback right now. Please try again later." },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
