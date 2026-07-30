import { cookies } from 'next/headers';
import crypto from 'node:crypto';

const COOKIE_NAME = 'fh_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Dev fallback secret. Real deployments MUST set AUTH_SECRET. We fall back to a
 * constant so DEMO mode works out of the box with no env configuration.
 */
const DEV_SECRET = 'file-hug-dev-secret-change-me';

let warnedMissingSecret = false;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length > 0) {
    return secret;
  }
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      '[auth] AUTH_SECRET is not set — using an insecure development secret. ' +
        'Set AUTH_SECRET in your environment for real sessions.'
    );
  }
  return DEV_SECRET;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  isDemo: boolean;
}

export interface Session {
  user: SessionUser;
}

/**
 * What actually gets signed into the cookie: the user plus an expiry.
 *
 * `exp` is seconds since the epoch. It is **required** — the Python intelligence
 * service (`services/intelligence/auth.py`) verifies the very same token and
 * rejects any payload without a live `exp`, so a token that omits it would
 * authenticate here and 401 there.
 */
interface SessionPayload extends SessionUser {
  exp: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function hmac(payloadB64: string): string {
  return base64url(crypto.createHmac('sha256', getSecret()).update(payloadB64).digest());
}

/** Sign a session payload into a `<payload>.<signature>` token. */
export function signPayload(user: SessionUser): string {
  const payload: SessionPayload = { ...user, exp: nowSeconds() + MAX_AGE_SECONDS };
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = hmac(payloadB64);
  return `${payloadB64}.${signature}`;
}

/** Verify a token's HMAC and expiry, returning the parsed user or null. */
export function verifyToken(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expected = hmac(payloadB64);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64url(payloadB64).toString('utf8')) as Partial<SessionPayload>;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.isDemo !== 'boolean'
    ) {
      return null;
    }
    // Reject expired tokens, and tokens with no expiry at all — the intelligence
    // service treats both as invalid, so accepting them here would produce a
    // session that works in the app but is refused by search/indexing.
    if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp) || parsed.exp <= nowSeconds()) {
      return null;
    }
    return {
      id: parsed.id,
      name: parsed.name,
      email: parsed.email,
      image: parsed.image ?? null,
      isDemo: parsed.isDemo,
    };
  } catch {
    return null;
  }
}

/** Read the signed session cookie. Returns null when absent or invalid. */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const user = verifyToken(token);
  return user ? { user } : null;
}

/**
 * The raw session token, verified but not decoded.
 *
 * Server-side callers that need to talk to the intelligence service forward this
 * as `Authorization: Bearer <token>` — that service verifies the same HMAC and
 * derives the user itself, so no user id is ever passed across the wire.
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !verifyToken(token)) return null;
  return token;
}

/** Set the signed session cookie. Call only from route handlers / server actions. */
export async function createSession(user: SessionUser): Promise<void> {
  const token = signPayload(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Clear the session cookie. Call only from route handlers / server actions. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
