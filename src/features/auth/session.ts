import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import crypto from 'node:crypto';
import {
  checkSession,
  extendSession,
  insertSession,
  revokeSession,
  type SessionMeta,
} from './sessionStore';

const COOKIE_NAME = 'fh_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
/**
 * Sliding renewal: a token with less than this much life left is re-issued for a
 * full MAX_AGE on the next `/api/auth/session` call — so anyone who opens the app
 * at least once a month simply stays signed in.
 */
const RENEW_AFTER_SECONDS = 60 * 60 * 24; // once a day at most

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
  /**
   * Id of this sign-in's `sessions` row. Absent for demo sessions, for tokens
   * minted when the session store was unavailable, and for tokens issued before
   * session management existed (those are upgraded by `renewSession`).
   */
  sid?: string;
}

interface TokenClaims {
  user: SessionUser;
  sid: string | null;
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
export function signPayload(
  user: SessionUser,
  sid: string | null = null,
  exp: number = nowSeconds() + MAX_AGE_SECONDS
): string {
  const payload: SessionPayload = { ...user, exp, ...(sid ? { sid } : {}) };
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = hmac(payloadB64);
  return `${payloadB64}.${signature}`;
}

/** Verify a token's HMAC and expiry, returning the parsed user or null. */
export function verifyToken(token: string | undefined | null): SessionUser | null {
  return parseToken(token)?.user ?? null;
}

/** Verify a token and return everything it claims. Signature/expiry only — no DB. */
function parseToken(token: string | undefined | null): TokenClaims | null {
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
      user: {
        id: parsed.id,
        name: parsed.name,
        email: parsed.email,
        image: parsed.image ?? null,
        isDemo: parsed.isDemo,
      },
      sid: typeof parsed.sid === 'string' && parsed.sid ? parsed.sid : null,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

/**
 * The current request's verified claims, including the server-side revocation
 * check. Memoised per request — layouts, pages and route handlers all call it.
 *
 * A token whose `sessions` row was revoked (signed out from another device) is
 * refused. If the row can't be checked at all — no database, table not created
 * yet, a transient error — the signed token is trusted, so the session store
 * can never lock everyone out.
 */
const readClaims = cache(async (): Promise<TokenClaims | null> => {
  const cookieStore = await cookies();
  const claims = parseToken(cookieStore.get(COOKIE_NAME)?.value);
  if (!claims) return null;
  if (claims.sid && !claims.user.isDemo) {
    const state = await checkSession(claims.sid, claims.user.id);
    if (state === 'revoked') return null;
  }
  return claims;
});

/** Read the signed session cookie. Returns null when absent, invalid or revoked. */
export async function getSession(): Promise<Session | null> {
  const claims = await readClaims();
  return claims ? { user: claims.user } : null;
}

/** Id of the current sign-in's `sessions` row, when it has one. */
export async function getCurrentSessionId(): Promise<string | null> {
  return (await readClaims())?.sid ?? null;
}

/**
 * The raw session token, verified but not decoded.
 *
 * Server-side callers that need to talk to the intelligence service forward this
 * as `Authorization: Bearer <token>` — that service verifies the same HMAC and
 * derives the user itself, so no user id is ever passed across the wire.
 */
export async function getSessionToken(): Promise<string | null> {
  if (!(await readClaims())) return null;
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

async function requestMeta(): Promise<SessionMeta> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    userAgent: h.get('user-agent'),
    ip: forwarded || h.get('x-real-ip') || null,
  };
}

async function writeCookie(token: string, exp: number): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.max(0, exp - nowSeconds()),
  });
}

/**
 * Sign the user in on this browser. Call only from route handlers / server actions.
 *
 * Real accounts get a `sessions` row so the sign-in shows up under "active
 * devices" and can be revoked. If the row can't be written the user still signs
 * in — they just won't be listed until the next renewal records them.
 */
export async function createSession(user: SessionUser): Promise<void> {
  const exp = nowSeconds() + MAX_AGE_SECONDS;
  const sid = user.isDemo ? null : await insertSession(user.id, new Date(exp * 1000), await requestMeta());
  await writeCookie(signPayload(user, sid, exp), exp);
}

/**
 * Keep an active user signed in: once a day, re-issue the token for a full
 * MAX_AGE and push the row's expiry out to match. Tokens from before session
 * management (no `sid`) get a row here, so they become revocable too.
 * Call only from route handlers.
 */
export async function renewSession(): Promise<void> {
  const claims = await readClaims();
  if (!claims || claims.user.isDemo) return;

  const now = nowSeconds();
  const needsRow = !claims.sid;
  if (!needsRow && claims.exp - now > MAX_AGE_SECONDS - RENEW_AFTER_SECONDS) return;

  const exp = now + MAX_AGE_SECONDS;
  let sid = claims.sid;
  if (sid) {
    // A row that vanished between the check and here was just revoked — don't
    // resurrect it with a fresh cookie.
    if (!(await extendSession(sid, claims.user.id, new Date(exp * 1000)))) return;
  } else {
    sid = await insertSession(claims.user.id, new Date(exp * 1000), await requestMeta());
    if (!sid) return;
  }
  await writeCookie(signPayload(claims.user, sid, exp), exp);
}

/** Sign this browser out (and revoke its row). Call only from route handlers / server actions. */
export async function destroySession(): Promise<void> {
  const claims = await readClaims();
  if (claims?.sid) await revokeSession(claims.user.id, claims.sid);
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
