export interface IMemory {
  id: string;
  userId?: string | null;
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  linkedMemoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
