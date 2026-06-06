import { memoryRepository } from '@/features/memories/repositories/MemoryRepository';
import { SaveMemoryInput, SaveResult, FetchResult } from '@/features/memories/types/memory.types';

function detectType(content: string): 'url' | 'note' {
  try {
    new URL(content.trim());
    return 'url';
  } catch {
    return 'note';
  }
}

function generateTitle(content: string, type: 'url' | 'note'): string {
  if (type === 'url') {
    try {
      const url = new URL(content.trim());
      return url.hostname.replace('www.', '');
    } catch {
      return 'Saved URL';
    }
  }
  const trimmed = content.trim();
  return trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
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

    const type = detectType(content);
    const title = generateTitle(content, type);

    const memory = await memoryRepository.create({ content, type, title, tags: [] });
    return { success: true, data: { memory: memory.toObject() } };
  }

  async getAll(): Promise<FetchResult> {
    const memories = await memoryRepository.findAll();
    return { success: true, data: { memories: memories.map((m) => m.toObject()) } };
  }
}

export const memoryService = new MemoryService();
