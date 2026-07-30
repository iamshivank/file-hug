/**
 * What we learned by opening a saved link — one row of `memory_index`, produced
 * by the intelligence service and attached to the memory on read.
 *
 * `status` is the honest state of that work: `pending` while the fetch is still
 * queued or in flight, `ready` once something searchable came back, `failed` when
 * the page could not be read (reason in `error`).
 */
export interface MemoryEnrichment {
  status: 'pending' | 'ready' | 'failed';
  /** The page's own title — distinct from the memory's platform label. */
  pageTitle?: string | null;
  description?: string | null;
  siteName?: string | null;
  author?: string | null;
  imageUrl?: string | null;
  faviconUrl?: string | null;
  keywords?: string[];
  /** True when the link had a transcript (captions) worth searching. */
  hasTranscript?: boolean;
  /** How much searchable text the page yielded. */
  indexedChars?: number;
  error?: string | null;
  fetchedAt?: string | Date | null;
  /** When this row last changed — used to spot a `pending` that has stalled. */
  updatedAt?: string | Date | null;
}

export interface MemoryData {
  id: string;
  content: string;
  type: 'url' | 'note';
  title: string;
  tags: string[];
  /** Ids of other memories (links or notes) this memory is connected to — bidirectional. */
  linkedMemoryIds?: string[];
  /** Present for link memories once the indexer has looked at them. */
  enrichment?: MemoryEnrichment | null;
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
