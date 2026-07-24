import { memoryRepository } from '@/features/memories/repositories/MemoryRepository';
import {
  SaveMemoryInput,
  UpdateMemoryInput,
  SaveResult,
  FetchResult,
} from '@/features/memories/types/memory.types';
import { detectContent } from '@/features/memories/utils/urlDetection';
import { getUserPlan } from '@/features/billing/subscription';
import { PLANS } from '@/features/billing/plans';
import { db } from '@/lib/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Max number of memories a single memory may be connected to. */
const MAX_CONNECTIONS = 25;

function noteTitleFrom(body: string): string {
  const firstLine = body.trim().split('\n')[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine || 'Untitled note';
}

export class MemoryService {
  async save(input: SaveMemoryInput, userId?: string): Promise<SaveResult> {
    // Notes are unlimited and may be title-only (empty body). Handle them first
    // so an empty body doesn't trip the link-path "content required" check.
    if (input.type === 'note') {
      const body = (input.content ?? '').trim();
      const providedTitle = (input.title ?? '').trim();

      if (!body && !providedTitle) {
        return { success: false, error: 'Add a title or a note to save.' };
      }
      if (body.length > 5000) {
        return { success: false, error: 'Note must be under 5000 characters.' };
      }

      const title = providedTitle || noteTitleFrom(body);
      if (title.length > 200) {
        return { success: false, error: 'Title must be under 200 characters.' };
      }

      const linkedMemoryIds = await this.resolveLinkedIds(input.linkedMemoryIds, userId);

      // Use a transaction to make the record write and bidirectional connection
      // updates atomic. If any connection fails, roll back the entire operation.
      const memory = await db.transaction(async (tx) => {
        const [newMemory] = await tx
          .insert((await import('@/db/schema')).memories)
          .values({
            content: body,
            type: 'note',
            title,
            tags: ['note'],
            linkedMemoryIds,
            userId,
          })
          .returning();

        // Mirror the connection onto every linked memory within the same transaction.
        for (const linkedId of linkedMemoryIds) {
          await tx.execute((await import('drizzle-orm')).sql`
            UPDATE memories
            SET linked_memory_ids = array_append(linked_memory_ids, ${newMemory.id}), updated_at = now()
            WHERE id = ${linkedId}
              AND user_id = ${userId}
              AND NOT (${newMemory.id} = ANY(linked_memory_ids))
              AND array_length(linked_memory_ids, 1) < 25
          `);
        }

        return newMemory;
      });

      return { success: true, data: { memory } };
    }

    // Link path — a URL is always required.
    const content = input.content?.trim();
    if (!content || content.length === 0) {
      return { success: false, error: 'Content is required.' };
    }
    if (content.length > 5000) {
      return { success: false, error: 'Content must be under 5000 characters.' };
    }

    const { type, title, tags } = detectContent(content);

    // Enforce the Free-plan link limit server-side (never blocks notes).
    if (type === 'url' && userId) {
      const plan = await getUserPlan(userId);
      const linkLimit = PLANS[plan].linkLimit;
      if (linkLimit !== null) {
        const existing = await memoryRepository.countLinks(userId);
        if (existing >= linkLimit) {
          return {
            success: false,
            error: "You've reached the Free plan limit of 1,000 links. Upgrade to save more.",
          };
        }
      }
    }

    const linkedMemoryIds = await this.resolveLinkedIds(input.linkedMemoryIds, userId);

    // Use a transaction to make the record write and bidirectional connection
    // updates atomic.
    const memory = await db.transaction(async (tx) => {
      const [newMemory] = await tx
        .insert((await import('@/db/schema')).memories)
        .values({
          content,
          type,
          title,
          tags,
          linkedMemoryIds,
          userId,
        })
        .returning();

      // Mirror the connection onto every linked memory within the same transaction.
      for (const linkedId of linkedMemoryIds) {
        await tx.execute((await import('drizzle-orm')).sql`
          UPDATE memories
          SET linked_memory_ids = array_append(linked_memory_ids, ${newMemory.id}), updated_at = now()
          WHERE id = ${linkedId}
            AND user_id = ${userId}
            AND NOT (${newMemory.id} = ANY(linked_memory_ids))
            AND array_length(linked_memory_ids, 1) < 25
        `);
      }

      return newMemory;
    });

    return { success: true, data: { memory } };
  }

  async update(input: UpdateMemoryInput, userId?: string): Promise<SaveResult> {
    if (!input.id || !UUID_REGEX.test(input.id)) {
      return { success: false, error: 'A valid memory id is required.' };
    }

    // Ownership check: require a defined userId. Unauthenticated/demo callers
    // cannot update memories.
    if (!userId) {
      return { success: false, error: 'Memory not found.' };
    }

    const existing = await memoryRepository.findById(input.id, userId);
    if (!existing) {
      return { success: false, error: 'Memory not found.' };
    }

    const patch: { content?: string; title?: string; linkedMemoryIds?: string[] } = {};

    if (input.content !== undefined) {
      const content = input.content.trim();
      if (content.length > 5000) {
        return { success: false, error: 'Content must be under 5000 characters.' };
      }
      // Notes may be emptied to title-only; links must always keep their URL.
      if (content.length === 0 && existing.type === 'url') {
        return { success: false, error: 'A link is required.' };
      }
      patch.content = content;
    }

    if (input.title !== undefined) {
      const fallbackBody = patch.content ?? existing.content;
      const title = input.title.trim() || noteTitleFrom(fallbackBody);
      if (title.length > 200) {
        return { success: false, error: 'Title must be under 200 characters.' };
      }
      patch.title = title;
    }

    // Connections are bidirectional and apply to both notes and links. Diff the
    // requested set against the stored set and mirror each change on the other side.
    if (input.linkedMemoryIds !== undefined) {
      const nextIds = await this.resolveLinkedIds(input.linkedMemoryIds, userId, existing.id);
      const prevIds = existing.linkedMemoryIds ?? [];
      const added = nextIds.filter((id) => !prevIds.includes(id));
      const removed = prevIds.filter((id) => !nextIds.includes(id));

      patch.linkedMemoryIds = nextIds;

      // Use a transaction to make the update and bidirectional connection changes atomic.
      const memory = await db.transaction(async (tx) => {
        // Apply the patch to the main memory record.
        const patchToApply = Object.keys(patch).length > 0 ? patch : null;
        let updated = existing;
        if (patchToApply) {
          const { memories: memoriesTable } = await import('@/db/schema');
          const { and, eq } = await import('drizzle-orm');
          const [result] = await tx
            .update(memoriesTable)
            .set({ ...patchToApply, updatedAt: new Date() })
            .where(and(eq(memoriesTable.id, input.id), eq(memoriesTable.userId, userId)))
            .returning();
          if (!result) {
            throw new Error('Memory not found during update');
          }
          updated = result;
        }

        // Mirror all connection changes within the same transaction.
        const { sql: sqlHelper } = await import('drizzle-orm');
        for (const id of added) {
          await tx.execute(sqlHelper`
            UPDATE memories
            SET linked_memory_ids = array_append(linked_memory_ids, ${existing.id}), updated_at = now()
            WHERE id = ${id}
              AND user_id = ${userId}
              AND NOT (${existing.id} = ANY(linked_memory_ids))
              AND array_length(linked_memory_ids, 1) < 25
          `);
        }
        for (const id of removed) {
          await tx.execute(sqlHelper`
            UPDATE memories
            SET linked_memory_ids = array_remove(linked_memory_ids, ${existing.id}), updated_at = now()
            WHERE id = ${id} AND user_id = ${userId}
          `);
        }

        return updated;
      });

      return { success: true, data: { memory } };
    }

    if (Object.keys(patch).length === 0) {
      return { success: true, data: { memory: existing } };
    }

    const memory = await memoryRepository.update(input.id, patch, userId);
    if (!memory) {
      return { success: false, error: 'Memory not found.' };
    }
    return { success: true, data: { memory } };
  }

  /**
   * Keep only ids that point to real memories the user owns (max MAX_CONNECTIONS),
   * excluding `selfId`. Both notes and links may be connected — the relationship
   * is an undirected graph, so we no longer restrict targets to link (url) type.
   * REQUIRES a defined `userId` — returns empty array when userId is absent.
   */
  private async resolveLinkedIds(ids?: string[], userId?: string, selfId?: string): Promise<string[]> {
    if (!userId || !Array.isArray(ids) || ids.length === 0) return [];
    const unique = [
      ...new Set(
        ids.filter((id) => typeof id === 'string' && UUID_REGEX.test(id) && id !== selfId)
      ),
    ].slice(0, MAX_CONNECTIONS);
    if (unique.length === 0) return [];
    const found = await memoryRepository.findByIds(unique, userId);
    return found.map((m) => m.id);
  }

  async getAll(userId?: string): Promise<FetchResult> {
    // Reads are scoped to the owner. Without a resolved user we return nothing
    // rather than leaking every user's memories.
    if (!userId) {
      return { success: true, data: { memories: [] } };
    }
    const memories = await memoryRepository.findAll(userId);
    return { success: true, data: { memories } };
  }
}

export const memoryService = new MemoryService();
