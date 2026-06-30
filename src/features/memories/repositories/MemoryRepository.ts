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

  async findByIds(ids: string[]): Promise<IMemory[]> {
    if (ids.length === 0) return [];
    return db.select().from(memories).where(inArray(memories.id, ids));
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
