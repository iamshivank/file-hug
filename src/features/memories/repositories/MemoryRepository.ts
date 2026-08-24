import { db } from '@/lib/db';
import { memories, memoryIndex, type MemoryIndexRow } from '@/db/schema';
import { eq, inArray, desc, count, and, sql } from 'drizzle-orm';
import { IMemory } from '@/models/Memory';
import { MemoryEnrichment } from '@/features/memories/types/memory.types';

/** A memory row plus the link-index row the intelligence service produced for it. */
export type MemoryWithEnrichment = IMemory & { enrichment: MemoryEnrichment | null };

interface CreateInput {
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  linkedMemoryIds?: string[];
  userId?: string | null;
}

interface UpdateInput {
  content?: string;
  title?: string;
  linkedMemoryIds?: string[];
}

/**
 * Project an index row into the client-facing shape.
 *
 * Deliberately drops `searchText` and `transcript`: they exist to be matched
 * against server-side and can run to tens of thousands of characters, so shipping
 * them to the browser would bloat every library fetch for no benefit. Their size
 * is surfaced as `indexedChars` instead.
 */
function toEnrichment(row: MemoryIndexRow | null): MemoryEnrichment | null {
  if (!row) return null;
  return {
    status: row.status,
    pageTitle: row.pageTitle,
    description: row.description,
    siteName: row.siteName,
    author: row.author,
    imageUrl: row.imageUrl,
    faviconUrl: row.faviconUrl,
    keywords: row.keywords ?? [],
    hasTranscript: !!row.transcript,
    indexedChars: row.searchText?.length ?? 0,
    error: row.error,
    fetchedAt: row.fetchedAt,
    updatedAt: row.updatedAt,
  };
}

export class MemoryRepository {
  async create(data: CreateInput): Promise<IMemory> {
    const [entry] = await db
      .insert(memories)
      .values({
        content: data.content,
        type: data.type,
        title: data.title,
        tags: data.tags,
        linkedMemoryIds: data.linkedMemoryIds ?? [],
        userId: data.userId ?? null,
      })
      .returning();
    return entry;
  }

  /** Fetch one memory. When `userId` is given, only returns it if that user owns it.
   * When `userId` is omitted, only returns memories with NULL userId (seed/demo rows). */
  async findById(id: string, userId?: string): Promise<IMemory | undefined> {
    const where = userId
      ? and(eq(memories.id, id), eq(memories.userId, userId))
      : and(eq(memories.id, id), sql`user_id IS NULL`);
    const [entry] = await db.select().from(memories).where(where).limit(1);
    return entry;
  }

  /** Fetch many memories by id, scoped to the owner when `userId` is given.
   * When `userId` is omitted, only returns memories with NULL userId. */
  async findByIds(ids: string[], userId?: string): Promise<IMemory[]> {
    if (ids.length === 0) return [];
    const where = userId
      ? and(inArray(memories.id, ids), eq(memories.userId, userId))
      : and(inArray(memories.id, ids), sql`user_id IS NULL`);
    return db.select().from(memories).where(where);
  }

  /** Update a memory. When `userId` is given, the write is scoped to the owner.
   * When `userId` is omitted, only updates memories with NULL userId. */
  async update(id: string, data: UpdateInput, userId?: string): Promise<IMemory | undefined> {
    const where = userId
      ? and(eq(memories.id, id), eq(memories.userId, userId))
      : and(eq(memories.id, id), sql`user_id IS NULL`);
    const [entry] = await db
      .update(memories)
      .set({ ...data, updatedAt: new Date() })
      .where(where)
      .returning();
    return entry;
  }

  /**
   * Add `otherId` to a memory's `linkedMemoryIds` (idempotent). Used to keep the
   * connection symmetric — when A links to B we also record A on B.
   * REQUIRES an explicit `userId` — does not mutate rows when `userId` is omitted.
   * Limits incoming connections to MAX_CONNECTIONS (25) to prevent unbounded growth.
   */
  async addConnection(id: string, otherId: string, userId?: string): Promise<void> {
    if (!userId) {
      // Do not mutate rows when userId is absent (no unscoped mutations).
      return;
    }
    await db.execute(sql`
      UPDATE memories
      SET linked_memory_ids = array_append(linked_memory_ids, ${otherId}), updated_at = now()
      WHERE id = ${id}
        AND user_id = ${userId}
        AND NOT (${otherId} = ANY(linked_memory_ids))
        AND array_length(linked_memory_ids, 1) < 25
    `);
  }

  /** Remove `otherId` from a memory's `linkedMemoryIds` (the reverse of addConnection).
   * REQUIRES an explicit `userId` — does not mutate rows when `userId` is omitted. */
  async removeConnection(id: string, otherId: string, userId?: string): Promise<void> {
    if (!userId) {
      // Do not mutate rows when userId is absent (no unscoped mutations).
      return;
    }
    await db.execute(sql`
      UPDATE memories
      SET linked_memory_ids = array_remove(linked_memory_ids, ${otherId}), updated_at = now()
      WHERE id = ${id} AND user_id = ${userId}
    `);
  }

  async findAll(userId?: string): Promise<IMemory[]> {
    const where = userId
      ? eq(memories.userId, userId)
      : sql`user_id IS NULL`;
    const rows = await db
      .select()
      .from(memories)
      .where(where)
      .orderBy(desc(memories.createdAt))
      .limit(100);
    return rows;
  }

  /**
   * Like `findAll`, but left-joins each link's index row so the UI can show the
   * real page title, description and preview image alongside the memory.
   *
   * A left join keeps un-indexed memories (and every note) in the result with a
   * null `enrichment`, and the whole thing stays one round trip.
   */
  async findAllWithEnrichment(userId?: string): Promise<MemoryWithEnrichment[]> {
    const where = userId
      ? eq(memories.userId, userId)
      : sql`user_id IS NULL`;

    const rows = await db
      .select({ memory: memories, index: memoryIndex })
      .from(memories)
      .leftJoin(memoryIndex, eq(memoryIndex.memoryId, memories.id))
      .where(where)
      .orderBy(desc(memories.createdAt))
      .limit(100);

    return rows.map(({ memory, index }) => ({
      ...memory,
      enrichment: toEnrichment(index),
    }));
  }

  /**
   * Record that a link is queued for indexing, so the UI can say "reading this
   * link…" the moment it is saved rather than looking permanently un-indexed.
   *
   * Idempotent, and never downgrades a row that already holds a result — a retry
   * of an already-`ready` link keeps showing its content while it re-fetches.
   */
  async markIndexPending(memoryId: string, userId: string, url: string): Promise<void> {
    await db
      .insert(memoryIndex)
      .values({ memoryId, userId, url, status: 'pending' })
      .onConflictDoNothing({ target: memoryIndex.memoryId });
  }

  /** The index row for a single memory, scoped to its owner. */
  async findEnrichment(memoryId: string, userId: string): Promise<MemoryEnrichment | null> {
    const [row] = await db
      .select()
      .from(memoryIndex)
      .where(and(eq(memoryIndex.memoryId, memoryId), eq(memoryIndex.userId, userId)))
      .limit(1);
    return toEnrichment(row ?? null);
  }

  async count(): Promise<number> {
    const [{ total }] = await db.select({ total: count() }).from(memories);
    return Number(total);
  }

  /** Count the user's saved link (url) memories — used to enforce plan limits. */
  async countLinks(userId?: string): Promise<number> {
    const where = userId
      ? and(eq(memories.type, 'url'), eq(memories.userId, userId))
      : eq(memories.type, 'url');
    const [{ total }] = await db.select({ total: count() }).from(memories).where(where);
    return Number(total);
  }
}

export const memoryRepository = new MemoryRepository();
