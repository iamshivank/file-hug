export interface MemoryData {
  id: string;
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  /** Ids of other memories (links or notes) this memory is connected to — bidirectional. */
  linkedMemoryIds?: string[];
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
  /** Other memories (links or notes) to connect this one to. */
  linkedMemoryIds?: string[];
}

export interface UpdateMemoryInput {
  /** Id of the memory to update. */
  id: string;
  /** New title — only applied when provided. */
  title?: string;
  /** New body/content — only applied when provided. */
  content?: string;
  /** Full replacement set of connected memory ids (links or notes) — bidirectional. */
  linkedMemoryIds?: string[];
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
