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
      const memory = await memoryRepository.create({
        content: body,
        type: 'note',
        title,
        tags: ['note'],
        linkedMemoryIds,
        userId,
      });

      // Mirror the connection onto every linked memory so it's discoverable
      // from both directions (a link now knows which notes point at it).
      await Promise.all(linkedMemoryIds.map((id) => memoryRepository.addConnection(id, memory.id, userId)));

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

    const memory = await memoryRepository.create({ content, type, title, tags, userId });
    return { success: true, data: { memory } };
  }

  async update(input: UpdateMemoryInput, userId?: string): Promise<SaveResult> {
    if (!input.id || !UUID_REGEX.test(input.id)) {
      return { success: false, error: 'A valid memory id is required.' };
    }

    // Ownership check: only the owner can read/update this memory. When no user
    // is resolved we fall back to an unscoped lookup (seed/anon rows).
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

      await Promise.all([
        ...added.map((id) => memoryRepository.addConnection(id, existing.id, userId)),
        ...removed.map((id) => memoryRepository.removeConnection(id, existing.id, userId)),
      ]);

      patch.linkedMemoryIds = nextIds;
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
   */
  private async resolveLinkedIds(ids?: string[], userId?: string, selfId?: string): Promise<string[]> {
    if (!Array.isArray(ids) || ids.length === 0) return [];
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
