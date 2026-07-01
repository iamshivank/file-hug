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

function noteTitleFrom(body: string): string {
  const firstLine = body.trim().split('\n')[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine || 'Untitled note';
}

export class MemoryService {
  async save(input: SaveMemoryInput, userId?: string): Promise<SaveResult> {
    const content = input.content?.trim();

    if (!content || content.length === 0) {
      return { success: false, error: 'Content is required.' };
    }

    if (content.length > 5000) {
      return { success: false, error: 'Content must be under 5000 characters.' };
    }

    // Notes are always unlimited — only link (url) memories are limited by plan.
    if (input.type === 'note') {
      const title = input.title?.trim() || noteTitleFrom(content);
      if (title.length > 200) {
        return { success: false, error: 'Title must be under 200 characters.' };
      }
      const linkedMemoryIds = await this.resolveLinkedIds(input.linkedMemoryIds);
      const memory = await memoryRepository.create({
        content,
        type: 'note',
        title,
        tags: ['note'],
        linkedMemoryIds,
        userId,
      });
      return { success: true, data: { memory } };
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

  async update(input: UpdateMemoryInput): Promise<SaveResult> {
    if (!input.id || !UUID_REGEX.test(input.id)) {
      return { success: false, error: 'A valid memory id is required.' };
    }

    const existing = await memoryRepository.findById(input.id);
    if (!existing) {
      return { success: false, error: 'Memory not found.' };
    }

    const patch: { content?: string; title?: string; linkedMemoryIds?: string[] } = {};

    if (input.content !== undefined) {
      const content = input.content.trim();
      if (content.length === 0) {
        return { success: false, error: 'Content is required.' };
      }
      if (content.length > 5000) {
        return { success: false, error: 'Content must be under 5000 characters.' };
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

    // Connected links only apply to notes; ignore the field for link memories.
    if (input.linkedMemoryIds !== undefined && existing.type === 'note') {
      patch.linkedMemoryIds = await this.resolveLinkedIds(input.linkedMemoryIds);
    }

    if (Object.keys(patch).length === 0) {
      return { success: true, data: { memory: existing } };
    }

    const memory = await memoryRepository.update(input.id, patch);
    if (!memory) {
      return { success: false, error: 'Memory not found.' };
    }
    return { success: true, data: { memory } };
  }

  /** Keep only ids that point to real saved link memories (max 10). */
  private async resolveLinkedIds(ids?: string[]): Promise<string[]> {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const unique = [...new Set(ids.filter((id) => typeof id === 'string' && UUID_REGEX.test(id)))].slice(0, 10);
    if (unique.length === 0) return [];
    const found = await memoryRepository.findByIds(unique);
    return found.filter((m) => m.type === 'url').map((m) => m.id);
  }

  async getAll(userId?: string): Promise<FetchResult> {
    const memories = await memoryRepository.findAll(userId);
    return { success: true, data: { memories } };
  }
}

export const memoryService = new MemoryService();
