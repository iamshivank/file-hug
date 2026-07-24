import { NextRequest, NextResponse } from 'next/server';

/**
 * Thin proxy to the standalone FastAPI "memory intelligence" service
 * (services/intelligence). It strips the `/api/intelligence` prefix and forwards
 * the signed session cookie as an `Authorization: Bearer` token — the service
 * verifies the same HMAC (shared AUTH_SECRET) and enforces per-user ownership.
 */
const SERVICE_URL = process.env.INTELLIGENCE_SERVICE_URL ?? 'http://localhost:8000';
const COOKIE_NAME = 'fh_session';

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const target = `${SERVICE_URL}/${path.join('/')}${request.nextUrl.search}`;
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
