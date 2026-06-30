export interface IMemory {
  id: string;
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  linkedMemoryIds: string[];
  createdAt: Date;
  updatedAt: Date;
}
