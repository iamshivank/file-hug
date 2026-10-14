import { memoryRepository } from '@/features/memories/repositories/MemoryRepository';
import {
  SaveMemoryInput,
  UpdateMemoryInput,
  SaveResult,
  FetchResult,
  MemoryData,
  MemoryEnrichment,
} from '@/features/memories/types/memory.types';
import { detectContent } from '@/features/memories/utils/urlDetection';
import { isIntelligenceEnabled } from '@/features/memories/services/intelligenceConfig';
import { getUserPlan } from '@/features/billing/subscription';
import { PLANS } from '@/features/billing/plans';
import { db } from '@/lib/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Max number of memories a single memory may be connected to. */
const MAX_CONNECTIONS = 25;

/**
 * True when an optional text field holds something other than a string. Request
 * bodies are untyped JSON, and calling `.trim()` on a number would throw out of
 * the service instead of returning a validation error.
 */
function isBadText(value: unknown): boolean {
  return value !== undefined && value !== null && typeof value !== 'string';
}

/** Shared shape check for save/update bodies. Returns an error message or null. */
function invalidInput(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Invalid request body.';
  const { content, title, tags, linkedMemoryIds } = input as Record<string, unknown>;
  if (isBadText(content)) return 'Content must be text.';
  if (isBadText(title)) return 'Title must be text.';
  if (tags !== undefined && tags !== null && !Array.isArray(tags)) return 'Tags must be a list.';
  if (linkedMemoryIds !== undefined && linkedMemoryIds !== null && !Array.isArray(linkedMemoryIds)) {
    return 'Connections must be a list of memory ids.';
  }
  return null;
}

function noteTitleFrom(body: string): string {
  const firstLine = body.trim().split('\n')[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine || 'Untitled note';
}

function cleanTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(
    tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => tag.trim().toLowerCase().replace(/^#/, ''))
      .filter((tag) => tag.length > 0 && tag.length <= 30)
  )].slice(0, 10);
}

export class MemoryService {
  async save(input: SaveMemoryInput, userId?: string): Promise<SaveResult> {
    // Writes no-op without a user — an anonymous or demo save would otherwise
    // insert an orphan row (user_id NULL) that no reader ever returns.
    if (!userId) {
      return { success: false, error: 'Sign in to save memories.' };
    }
    const invalid = invalidInput(input);
    if (invalid) return { success: false, error: invalid };

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
        // The cap uses cardinality(), not array_length(): array_length of an empty
        // array is NULL, so `< 25` was never true for a memory with no connections
        // yet and the mirror was silently skipped.
        for (const linkedId of linkedMemoryIds) {
          await tx.execute((await import('drizzle-orm')).sql`
            UPDATE memories
            SET linked_memory_ids = array_append(linked_memory_ids, ${newMemory.id}), updated_at = now()
            WHERE id = ${linkedId}
              AND user_id = ${userId}
              AND NOT (${newMemory.id} = ANY(linked_memory_ids))
              AND cardinality(linked_memory_ids) < 25
          `);
        }

        return newMemory;
      });

      return { success: true, data: { memory } };
    }

    // Link path — a URL is always required.
    const rawContent = input.content?.trim();
    if (!rawContent || rawContent.length === 0) {
      return { success: false, error: 'Content is required.' };
    }
    if (rawContent.length > 5000) {
      return { success: false, error: 'Content must be under 5000 characters.' };
    }

    // Detection normalises what was pasted — `instagram.com/reel/x` becomes a real
    // absolute URL — and we store that form so embeds, previews and the indexer
    // all work off a URL they can parse.
    const detected = detectContent(rawContent);
    const { type, url } = detected;
    // An explicit `type: 'url'` is a claim, not a hint — don't quietly file
    // unparseable text as a note.
    if (input.type === 'url' && type !== 'url') {
      return { success: false, error: 'A valid link is required.' };
    }
    const content = type === 'url' ? url : rawContent;
    const customTitle = input.title?.trim();
    if (customTitle && customTitle.length > 200) {
      return { success: false, error: 'Title must be under 200 characters.' };
    }
    const title = customTitle || detected.title;
    const tags = [...new Set([...detected.tags, ...cleanTags(input.tags)])].slice(0, 10);

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
      const schema = await import('@/db/schema');
      const [newMemory] = await tx
        .insert(schema.memories)
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
            AND cardinality(linked_memory_ids) < 25
        `);
      }

      return newMemory;
    });

    // Queue the link for indexing so the UI can show "reading this link…" right
    // away. Deliberately OUTSIDE the transaction and best-effort: this row is a
    // progress indicator, and losing it must never cost the user their save (the
    // table may not exist yet if the schema hasn't been pushed).
    //
    // Skipped entirely when no intelligence service is configured — a pending row
    // nothing will ever pick up would leave every link stuck on "reading…".
    let queuedForIndexing = false;
    if (type === 'url' && userId && isIntelligenceEnabled()) {
      try {
        await memoryRepository.markIndexPending(memory.id, userId, content);
        queuedForIndexing = true;
      } catch (error) {
        console.warn(
          '[memories] could not queue link for indexing. ' +
            'Run `npm run db:push` to create memory_index.',
          error
        );
      }
    }

    return {
      success: true,
      data: {
        memory: queuedForIndexing
          ? { ...memory, enrichment: { status: 'pending' as const } }
          : memory,
      },
    };
  }

  async update(input: UpdateMemoryInput, userId?: string): Promise<SaveResult> {
    const invalid = invalidInput(input);
    if (invalid) return { success: false, error: invalid };
    if (typeof input.id !== 'string' || !UUID_REGEX.test(input.id)) {
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

    if (input.content != null) {
      const content = input.content.trim();
      if (content.length > 5000) {
        return { success: false, error: 'Content must be under 5000 characters.' };
      }
      // Notes may be emptied to title-only; links must always keep their URL.
      if (content.length === 0 && existing.type === 'url') {
        return { success: false, error: 'A link is required.' };
      }
      if (existing.type === 'url') {
        const detected = detectContent(content);
        if (detected.type !== 'url') return { success: false, error: 'A valid link is required.' };
        patch.content = detected.url;
      } else {
        patch.content = content;
      }
    }

    if (input.title != null) {
      const fallbackBody = patch.content ?? existing.content;
      const title = input.title.trim() || noteTitleFrom(fallbackBody);
      if (title.length > 200) {
        return { success: false, error: 'Title must be under 200 characters.' };
      }
      patch.title = title;
    }

    // Connections are bidirectional and apply to both notes and links. Diff the
    // requested set against the stored set and mirror each change on the other side.
    // A link whose URL actually changed needs its index rebuilt — the stored
    // page title, description and embedding describe the old page.
    const urlChanged =
      existing.type === 'url' && patch.content !== undefined && patch.content !== existing.content;

    if (input.linkedMemoryIds != null) {
      const prevIds = existing.linkedMemoryIds ?? [];
      const nextIds = await this.resolveLinkedIds(input.linkedMemoryIds, userId, existing.id, prevIds);
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
              AND cardinality(linked_memory_ids) < 25
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

      return { success: true, data: { memory: await this.withIndexReset(memory, userId, urlChanged) } };
    }

    if (Object.keys(patch).length === 0) {
      return { success: true, data: { memory: existing } };
    }

    const memory = await memoryRepository.update(input.id, patch, userId);
    if (!memory) {
      return { success: false, error: 'Memory not found.' };
    }
    return { success: true, data: { memory: await this.withIndexReset(memory, userId, urlChanged) } };
  }

  /**
   * After a link's URL changes, clear what was learned about the old page.
   *
   * With the intelligence service configured the row goes back to `pending` (the
   * caller then triggers a fresh index, exactly as after a save). Without it, the
   * row is removed — the feature is off, so the link should look un-indexed, not
   * failed. Best-effort either way: the edit itself already succeeded, and a
   * missing `memory_index` table must never turn it into an error.
   */
  private async withIndexReset(
    memory: MemoryData,
    userId: string,
    urlChanged: boolean
  ): Promise<MemoryData> {
    if (!urlChanged) return memory;
    let enrichment: MemoryEnrichment | null = null;
    try {
      if (isIntelligenceEnabled()) {
        await memoryRepository.resetIndex(memory.id, userId, memory.content);
        enrichment = { status: 'pending' };
      } else {
        await memoryRepository.deleteIndex(memory.id, userId);
      }
    } catch (error) {
      console.warn('[memories] could not reset the link index after an edit.', error);
    }
    return { ...memory, enrichment };
  }

  /**
   * Index a saved link in the background and record a failure if the service
   * never answered. Never throws — this runs inside `after()`, where a rejection
   * would surface as an unhandled error with nobody to report it to.
   */
  async indexLink(
    memoryId: string,
    userId: string,
    sessionToken: string,
    options: { force?: boolean } = {}
  ): Promise<void> {
    const { indexMemory } = await import('./IntelligenceClient');
    const indexed = await indexMemory(memoryId, sessionToken, options);
    if (indexed) return;
    try {
      await memoryRepository.markIndexFailed(memoryId, userId);
    } catch (error) {
      console.warn(`[memories] could not mark ${memoryId} as failed.`, error);
    }
  }

  /**
   * Keep only ids that point to real memories the user owns (max MAX_CONNECTIONS),
   * excluding `selfId`. Both notes and links may be connected — the relationship
   * is an undirected graph, so we no longer restrict targets to link (url) type.
   *
   * A *new* connection to a memory that is already at the cap is dropped: the
   * mirror write would be refused, leaving a one-sided connection. Ids in
   * `alreadyLinked` are kept as-is.
   * REQUIRES a defined `userId` — returns empty array when userId is absent.
   */
  private async resolveLinkedIds(
    ids?: string[],
    userId?: string,
    selfId?: string,
    alreadyLinked: string[] = []
  ): Promise<string[]> {
    if (!userId || !Array.isArray(ids) || ids.length === 0) return [];
    const unique = [
      ...new Set(
        ids.filter((id) => typeof id === 'string' && UUID_REGEX.test(id) && id !== selfId)
      ),
    ].slice(0, MAX_CONNECTIONS);
    if (unique.length === 0) return [];
    const found = await memoryRepository.findByIds(unique, userId);
    return found
      .filter((m) => {
        if (alreadyLinked.includes(m.id)) return true;
        const theirs = m.linkedMemoryIds ?? [];
        return (selfId !== undefined && theirs.includes(selfId)) || theirs.length < MAX_CONNECTIONS;
      })
      .map((m) => m.id);
  }

  async getAll(userId?: string): Promise<FetchResult> {
    // Reads are scoped to the owner. Without a resolved user we return nothing
    // rather than leaking every user's memories.
    if (!userId) {
      return { success: true, data: { memories: [] } };
    }
    try {
      const memories = await memoryRepository.findAllWithEnrichment(userId);
      return { success: true, data: { memories } };
    } catch (error) {
      // `memory_index` may not exist yet (schema not pushed). The library is the
      // core feature — serve it without enrichment rather than failing the whole
      // read over an optional column.
      console.warn(
        '[memories] enrichment unavailable, serving memories without it. ' +
          'Run `npm run db:push` to create memory_index.',
        error
      );
      const memories = await memoryRepository.findAll(userId);
      return { success: true, data: { memories } };
    }
  }

  /**
   * Re-index a saved link — open the URL again and rebuild its search index.
   *
   * Unlike the fire-and-forget indexing after a save, this waits for the result
   * and returns the refreshed memory with its updated enrichment. Used for retrying
   * a link whose first read failed, or manually refreshing a link that changed.
   */
  async reindex(memoryId: string, userId: string, sessionToken: string): Promise<SaveResult> {
    if (!UUID_REGEX.test(memoryId)) {
      return { success: false, error: 'A valid memory id is required.' };
    }

    const memory = await memoryRepository.findById(memoryId, userId);
    if (!memory) {
      return { success: false, error: 'Memory not found.' };
    }
    if (memory.type !== 'url') {
      return { success: false, error: 'Only links can be indexed.' };
    }
    // Switched off is a deployment choice, not an outage — say so rather than
    // reporting the service as unavailable.
    if (!isIntelligenceEnabled()) {
      return { success: false, error: 'Link intelligence is not configured for this deployment.' };
    }

    // Import indexMemory here to avoid circular dependencies
    const { indexMemory } = await import('./IntelligenceClient');
    const result = await indexMemory(memoryId, sessionToken, { force: true });
    if (!result) {
      return {
        success: false,
        error: 'The memory intelligence service is unavailable. Try again shortly.',
      };
    }

    // Read back the persisted row so the response matches what other reads return
    const enrichment = await memoryRepository.findEnrichment(memoryId, userId);
    const refreshed = await memoryRepository.findById(memoryId, userId);

    return {
      success: true,
      data: { memory: { ...(refreshed ?? memory), enrichment } },
    };
  }
}

export const memoryService = new MemoryService();
