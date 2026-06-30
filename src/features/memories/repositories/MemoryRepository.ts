import { db } from '@/lib/db';
import { memories } from '@/db/schema';
import { eq, inArray, desc, count } from 'drizzle-orm';
import { IMemory } from '@/models/Memory';

interface CreateInput {
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  linkedMemoryIds?: string[];
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
      })
      .returning();
    return entry;
  }

  async findById(id: string): Promise<IMemory | undefined> {
    const [entry] = await db.select().from(memories).where(eq(memories.id, id)).limit(1);
    return entry;
  }

  async findByIds(ids: string[]): Promise<IMemory[]> {
    if (ids.length === 0) return [];
    return db.select().from(memories).where(inArray(memories.id, ids));
  }

  async update(id: string, data: UpdateInput): Promise<IMemory | undefined> {
    const [entry] = await db
      .update(memories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(memories.id, id))
      .returning();
    return entry;
  }

  async findAll(): Promise<IMemory[]> {
    return db.select().from(memories).orderBy(desc(memories.createdAt)).limit(100);
  }

  async count(): Promise<number> {
    const [{ total }] = await db.select({ total: count() }).from(memories);
    return Number(total);
  }
}

export const memoryRepository = new MemoryRepository();
