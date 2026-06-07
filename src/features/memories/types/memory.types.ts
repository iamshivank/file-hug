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
  /** A URL (link mode) or the note body (note mode). */
  content: string;
  /** Optional user-provided title — used in note mode. */
  title?: string;
  /** Explicit mode from the UI. When omitted the service auto-detects. */
  type?: 'url' | 'note';
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
