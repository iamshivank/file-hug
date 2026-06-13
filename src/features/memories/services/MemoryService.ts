import { memoryRepository } from '@/features/memories/repositories/MemoryRepository';
import { SaveMemoryInput, SaveResult, FetchResult } from '@/features/memories/types/memory.types';
import { detectContent } from '@/features/memories/utils/urlDetection';

function noteTitleFrom(body: string): string {
  const firstLine = body.trim().split('\n')[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine || 'Untitled note';
}

export class MemoryService {
  async save(input: SaveMemoryInput): Promise<SaveResult> {
    const content = input.content?.trim();

    if (!content || content.length === 0) {
      return { success: false, error: 'Content is required.' };
    }

    if (content.length > 5000) {
      return { success: false, error: 'Content must be under 5000 characters.' };
    }

    // Note mode: explicit note from the UI — keep the body as-is and use the
    // user's title (falling back to the first line).
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
      });
      return { success: true, data: { memory: memory.toObject() } };
    }

    // Link / auto mode: detect platform, type, title and tags from the content.
    const { type, title, tags } = detectContent(content);
    const memory = await memoryRepository.create({ content, type, title, tags });
    return { success: true, data: { memory: memory.toObject() } };
  }

  /** Keep only ids that point to real saved link memories (max 10). */
  private async resolveLinkedIds(ids?: string[]): Promise<string[]> {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const unique = [...new Set(ids.filter((id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)))].slice(0, 10);
    if (unique.length === 0) return [];
    const found = await memoryRepository.findByIds(unique);
    return found.filter((m) => m.type === 'url').map((m) => String(m._id));
  }

  async getAll(): Promise<FetchResult> {
    const memories = await memoryRepository.findAll();
    return { success: true, data: { memories: memories.map((m) => m.toObject()) } };
  }
}

export const memoryService = new MemoryService();
