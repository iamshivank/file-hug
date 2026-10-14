import 'server-only';

/**
 * Server-side session rows — the `sessions` table behind "active devices".
 *
 * The cookie stays a self-contained HMAC token (the intelligence service verifies
 * it without a database round-trip of its own design), and carries the row id as
 * `sid`. These helpers are the only code that touches the table.
 *
 * Like the billing writers, everything here degrades instead of throwing: no
 * database, or a database where `npm run db:push` hasn't created the table yet,
 * must never lock anyone out. Callers get `null` / `'unknown'` and carry on with a
 * plain signed token.
 */

const DEMO_MODE = process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true';

export function hasSessionStore(): boolean {
  return !DEMO_MODE && Boolean(process.env.DATABASE_URL);
}

/** Only touch `last_seen_at` this often — it's a write on a read path. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface SessionMeta {
  userAgent: string | null;
  ip: string | null;
}

export interface ActiveSession {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

/** `valid` / `revoked` are authoritative; `unknown` means we couldn't check. */
export type SessionCheck = 'valid' | 'revoked' | 'unknown';

async function load() {
  const { db } = await import('@/lib/db');
  const { sessions } = await import('@/db/schema');
  const orm = await import('drizzle-orm');
  return { db, sessions, ...orm };
}

/** Insert a row for a fresh sign-in. Returns its id, or null if it couldn't be stored. */
export async function insertSession(
  userId: string,
  expiresAt: Date,
  meta: SessionMeta
): Promise<string | null> {
  if (!hasSessionStore()) return null;
  try {
    const { db, sessions } = await load();
    const [row] = await db
      .insert(sessions)
      .values({
        userId,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 512) ?? null,
        ip: meta.ip?.slice(0, 64) ?? null,
      })
      .returning({ id: sessions.id });
    return row?.id ?? null;
  } catch (error) {
    console.error('[auth] could not record session:', error);
    return null;
  }
}

/**
 * Is this session still live? Also bumps `last_seen_at` when it's stale.
 *
 * A missing row counts as revoked: rows are only ever removed by revoking, and a
 * token naming a row that never existed is not one we issued.
 */
export async function checkSession(sid: string, userId: string): Promise<SessionCheck> {
  if (!hasSessionStore()) return 'unknown';
  try {
    const { db, sessions, and, eq } = await load();
    const [row] = await db
      .select({
        revokedAt: sessions.revokedAt,
        expiresAt: sessions.expiresAt,
        lastSeenAt: sessions.lastSeenAt,
      })
      .from(sessions)
      .where(and(eq(sessions.id, sid), eq(sessions.userId, userId)))
      .limit(1);

    const now = Date.now();
    if (!row || row.revokedAt || row.expiresAt.getTime() <= now) return 'revoked';

    if (now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await db
        .update(sessions)
        .set({ lastSeenAt: new Date(now) })
        .where(eq(sessions.id, sid))
        .catch((error: unknown) => console.error('[auth] could not touch session:', error));
    }
    return 'valid';
  } catch (error) {
    console.error('[auth] session check failed; trusting the signed token:', error);
    return 'unknown';
  }
}

/** Push a live session's expiry out (sliding renewal). */
export async function extendSession(sid: string, userId: string, expiresAt: Date): Promise<boolean> {
  if (!hasSessionStore()) return false;
  try {
    const { db, sessions, and, eq, isNull } = await load();
    const rows = await db
      .update(sessions)
      .set({ expiresAt, lastSeenAt: new Date() })
      .where(and(eq(sessions.id, sid), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  } catch (error) {
    console.error('[auth] could not extend session:', error);
    return false;
  }
}

/** Live sessions for a user, most recently active first. Null if unavailable. */
export async function listSessions(userId: string): Promise<ActiveSession[] | null> {
  if (!hasSessionStore()) return null;
  try {
    const { db, sessions, and, eq, isNull, gt, desc } = await load();
    return await db
      .select({
        id: sessions.id,
        userAgent: sessions.userAgent,
        ip: sessions.ip,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(eq(sessions.userId, userId), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()))
      )
      .orderBy(desc(sessions.lastSeenAt))
      .limit(50);
  } catch (error) {
    console.error('[auth] could not list sessions:', error);
    return null;
  }
}

/** Revoke one of the user's sessions. Returns false if nothing matched. */
export async function revokeSession(userId: string, sid: string): Promise<boolean> {
  if (!hasSessionStore()) return false;
  try {
    const { db, sessions, and, eq, isNull } = await load();
    const rows = await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, sid), eq(sessions.userId, userId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  } catch (error) {
    console.error('[auth] could not revoke session:', error);
    return false;
  }
}

/** Revoke every session of the user except `keepSid`. Returns how many, or null on failure. */
export async function revokeOtherSessions(userId: string, keepSid: string | null): Promise<number | null> {
  if (!hasSessionStore()) return null;
  try {
    const { db, sessions, and, eq, ne, isNull } = await load();
    const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
    if (keepSid) conditions.push(ne(sessions.id, keepSid));
    const rows = await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: sessions.id });
    return rows.length;
  } catch (error) {
    console.error('[auth] could not revoke sessions:', error);
    return null;
  }
}
