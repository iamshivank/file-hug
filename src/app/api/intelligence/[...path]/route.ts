import { NextRequest, NextResponse } from 'next/server';
import { INTELLIGENCE_SERVICE_URL } from '@/features/memories/services/intelligenceConfig';

/**
 * Thin proxy to the standalone FastAPI "memory intelligence" service
 * (services/intelligence). It strips the `/api/intelligence` prefix and forwards
 * the signed session cookie as an `Authorization: Bearer` token — the service
 * verifies the same HMAC (shared AUTH_SECRET) and enforces per-user ownership.
 *
 * Returns 503 with `configured: false` when no service URL is set, so a
 * deployment without the companion process degrades silently rather than
 * reporting an outage.
 */
const COOKIE_NAME = 'fh_session';

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  // No service configured is a deployment choice, not a fault. `configured: false`
  // lets callers tell "this feature is switched off" apart from "it's broken", so
  // the UI can fall back silently instead of warning users about an outage.
  if (!INTELLIGENCE_SERVICE_URL) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: 'Memory intelligence is not configured for this deployment.',
      },
      { status: 503 }
    );
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const target = `${INTELLIGENCE_SERVICE_URL}/${path.join('/')}${request.nextUrl.search}`;
  const headers: Record<string, string> = { authorization: `Bearer ${token}` };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const res = await fetch(target, init);
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'The memory intelligence service is unavailable.' },
      { status: 502 }
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(request, (await ctx.params).path);
}

export async function POST(request: NextRequest, ctx: Ctx): Promise<NextResponse> {
  return proxy(request, (await ctx.params).path);
}
