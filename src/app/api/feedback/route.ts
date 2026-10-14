import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/features/auth/session';
import { describeUserAgent } from '@/features/auth/userAgent';
import { getUserPlan } from '@/features/billing/subscription';
import {
  FEEDBACK_KINDS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MIN_LENGTH,
  type FeedbackKind,
} from '@/features/feedback/constants';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(['landing', 'app']);
const THEMES = new Set(['light', 'dark']);

/** A bounded string field from untrusted JSON, or null. */
function str(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Same-site paths only (`/app/profile`), never an absolute or protocol-relative URL. */
function pagePath(value: unknown): string | null {
  const path = str(value, 500);
  return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
}

/** Whether a Postgres error (possibly wrapped by Drizzle) has this SQLSTATE. */
function hasPgCode(error: unknown, code: string): boolean {
  const codeOf = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return codeOf(error) === code || codeOf((error as { cause?: unknown } | null)?.cause) === code;
}
const UNDEFINED_TABLE = '42P01';
const FOREIGN_KEY_VIOLATION = '23503';

/**
 * Store a piece of feedback, with enough context to act on it: who sent it (and
 * on which plan), which page they were on, and what they were using. Anonymous
 * visitors are welcome; signed-in users are attributed automatically.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true' || !process.env.DATABASE_URL) {
    return NextResponse.json(
      { success: false, error: "Feedback isn't being collected on this deployment." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 });
  }

  // Honeypot: a field real users never see. Pretend success so bots move on.
  if (str(body.website, 200)) {
    return NextResponse.json({ success: true }, { status: 201 });
  }

  const kind: FeedbackKind = FEEDBACK_KINDS.includes(body.kind as FeedbackKind)
    ? (body.kind as FeedbackKind)
    : 'other';

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < FEEDBACK_MIN_LENGTH) {
    return NextResponse.json({ success: false, error: 'Please tell us a little more.' }, { status: 400 });
  }
  if (message.length > FEEDBACK_MAX_LENGTH) {
    return NextResponse.json(
      { success: false, error: `Please keep it under ${FEEDBACK_MAX_LENGTH.toLocaleString()} characters.` },
      { status: 400 }
    );
  }

  const rating =
    typeof body.rating === 'number' && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5
      ? body.rating
      : null;

  const typedEmail = str(body.email, 255)?.toLowerCase() ?? null;
  if (typedEmail && !EMAIL_RE.test(typedEmail)) {
    return NextResponse.json({ success: false, error: "That email doesn't look right." }, { status: 400 });
  }

  const session = await getSession();
  const user = session?.user ?? null;
  const isRealUser = !!user && !user.isDemo;
  const userAgent = request.headers.get('user-agent');
  const theme = str(body.theme, 16);
  const source = str(body.source, 32);

  try {
    const { db } = await import('@/lib/db');
    const { feedback } = await import('@/db/schema');
    const row = {
      kind,
      rating,
      message,
      // Demo sessions share one fake identity — don't attribute to it.
      userId: isRealUser ? user.id : null,
      userName: isRealUser ? user.name.slice(0, 200) : null,
      email: typedEmail ?? (isRealUser ? user.email : null),
      plan: isRealUser ? await getUserPlan(user.id) : null,
      isDemo: !!user?.isDemo,
      source: source && SOURCES.has(source) ? source : null,
      pageUrl: pagePath(body.page),
      device: describeUserAgent(userAgent).slice(0, 100),
      userAgent: userAgent?.slice(0, 512) ?? null,
      viewport: str(body.viewport, 32),
      locale: str(body.locale, 35),
      timezone: str(body.timezone, 64),
      theme: theme && THEMES.has(theme) ? theme : null,
    };
    try {
      await db.insert(feedback).values(row);
    } catch (error) {
      // A session whose user row is gone shouldn't cost us the feedback itself:
      // keep the name/email it carried, just drop the link.
      if (!row.userId || !hasPgCode(error, FOREIGN_KEY_VIOLATION)) throw error;
      await db.insert(feedback).values({ ...row, userId: null });
    }
  } catch (error) {
    if (hasPgCode(error, UNDEFINED_TABLE)) {
      console.error('[feedback] the feedback table does not exist — run `npm run db:push`.');
    } else {
      console.error('[feedback] could not store feedback:', error);
    }
    return NextResponse.json(
      { success: false, error: "Couldn't send your feedback right now. Please try again later." },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
