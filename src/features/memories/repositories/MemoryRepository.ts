import { db } from '@/lib/db';
import { memories } from '@/db/schema';
import { eq, inArray, desc, count, and, sql } from 'drizzle-orm';
import { IMemory } from '@/models/Memory';

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

  /** Fetch one memory. When `userId` is given, only returns it if that user owns it. */
  async findById(id: string, userId?: string): Promise<IMemory | undefined> {
    const where = userId ? and(eq(memories.id, id), eq(memories.userId, userId)) : eq(memories.id, id);
    const [entry] = await db.select().from(memories).where(where).limit(1);
    return entry;
  }

  /** Fetch many memories by id, scoped to the owner when `userId` is given. */
  async findByIds(ids: string[], userId?: string): Promise<IMemory[]> {
    if (ids.length === 0) return [];
    const where = userId
      ? and(inArray(memories.id, ids), eq(memories.userId, userId))
      : inArray(memories.id, ids);
    return db.select().from(memories).where(where);
  }

  /** Update a memory. When `userId` is given, the write is scoped to the owner. */
  async update(id: string, data: UpdateInput, userId?: string): Promise<IMemory | undefined> {
    const where = userId ? and(eq(memories.id, id), eq(memories.userId, userId)) : eq(memories.id, id);
    const [entry] = await db
      .update(memories)
      .set({ ...data, updatedAt: new Date() })
      .where(where)
      .returning();
    return entry;
  }

  /**
   * Add `otherId` to a memory's `linkedMemoryIds` (idempotent). Used to keep the
   * connection symmetric — when A links to B we also record A on B. Scoped to the
   * owner so one user can never mutate another user's connections.
   */
  async addConnection(id: string, otherId: string, userId?: string): Promise<void> {
    const owner = userId ? sql` AND user_id = ${userId}` : sql``;
    await db.execute(sql`
      UPDATE memories
      SET linked_memory_ids = array_append(linked_memory_ids, ${otherId}), updated_at = now()
      WHERE id = ${id} AND NOT (${otherId} = ANY(linked_memory_ids))${owner}
    `);
  }

  /** Remove `otherId` from a memory's `linkedMemoryIds` (the reverse of addConnection). */
  async removeConnection(id: string, otherId: string, userId?: string): Promise<void> {
    const owner = userId ? sql` AND user_id = ${userId}` : sql``;
    await db.execute(sql`
      UPDATE memories
      SET linked_memory_ids = array_remove(linked_memory_ids, ${otherId}), updated_at = now()
      WHERE id = ${id}${owner}
    `);
  }

  async findAll(userId?: string): Promise<IMemory[]> {
    const query = db.select().from(memories);
    const rows = userId
      ? await query.where(eq(memories.userId, userId)).orderBy(desc(memories.createdAt)).limit(100)
      : await query.orderBy(desc(memories.createdAt)).limit(100);
    return rows;
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
