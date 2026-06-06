import { memoryRepository } from '@/features/memories/repositories/MemoryRepository';
import { SaveMemoryInput, SaveResult, FetchResult } from '@/features/memories/types/memory.types';
import { detectContent } from '@/features/memories/utils/urlDetection';

export class MemoryService {
  async save(input: SaveMemoryInput): Promise<SaveResult> {
    const content = input.content?.trim();

    if (!content || content.length === 0) {
      return { success: false, error: 'Content is required.' };
    }

    if (content.length > 5000) {
      return { success: false, error: 'Content must be under 5000 characters.' };
    }

    const { type, title, tags } = detectContent(content);

    const memory = await memoryRepository.create({ content, type, title, tags });
    return { success: true, data: { memory: memory.toObject() } };
  }

  async getAll(): Promise<FetchResult> {
    const memories = await memoryRepository.findAll();
    return { success: true, data: { memories: memories.map((m) => m.toObject()) } };
  }
}

export const memoryService = new MemoryService();
