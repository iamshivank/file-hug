export interface MemoryData {
  _id: string;
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface SaveMemoryInput {
  content: string;
}

export interface SaveResult {
  success: boolean;
  data?: { memory: MemoryData };
  error?: string;
}

export interface FetchResult {
  success: boolean;
  data?: { memories: MemoryData[] };
  error?: string;
}
