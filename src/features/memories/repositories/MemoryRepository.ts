import { connectToDatabase } from '@/lib/mongodb';
import Memory, { IMemory } from '@/models/Memory';

interface CreateInput {
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  linkedMemoryIds?: string[];
}

export class MemoryRepository {
  async create(data: CreateInput): Promise<IMemory> {
    await connectToDatabase();
    return Memory.create(data);
  }

  async findByIds(ids: string[]): Promise<IMemory[]> {
    await connectToDatabase();
    return Memory.find({ _id: { $in: ids } });
  }

  async findAll(): Promise<IMemory[]> {
    await connectToDatabase();
    return Memory.find().sort({ createdAt: -1 }).limit(100);
  }

  async count(): Promise<number> {
    await connectToDatabase();
    return Memory.countDocuments();
  }
}

export const memoryRepository = new MemoryRepository();
