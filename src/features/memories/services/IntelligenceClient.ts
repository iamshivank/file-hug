import 'server-only';

/**
 * Server-side client for the standalone FastAPI intelligence service
 * (`services/intelligence`).
 *
 * The browser reaches that service through the `/api/intelligence/*` proxy. This
 * client is for the *server* calling it directly — currently to index a link
 * right after it is saved. Authentication is the user's own signed session token
 * forwarded as a Bearer credential, so the service scopes every write to the
 * same user without us passing a user id.
 *
 * Nothing here throws. The service is an optional companion process: when it is
 * not configured or not running, saving a link must still succeed, just without
 * enrichment.
 */

import { INTELLIGENCE_SERVICE_URL, isIntelligenceEnabled } from './intelligenceConfig';

export { isIntelligenceEnabled };

/** Indexing opens a real page; allow for a slow origin but never hang a request. */
const INDEX_TIMEOUT_MS = 20_000;

export interface IndexResult {
  memoryId: string;
  status: 'ready' | 'failed' | 'skipped';
  url?: string | null;
  pageTitle?: string | null;
  description?: string | null;
  siteName?: string | null;
  author?: string | null;
  imageUrl?: string | null;
  faviconUrl?: string | null;
  keywords?: string[];
  hasTranscript?: boolean;
  indexedChars?: number;
  error?: string | null;
}

/** Shape returned by the service's `POST /index` (snake_case over the wire). */
interface RawIndexResponse {
  memory_id: string;
  status: string;
  url?: string | null;
  page_title?: string | null;
  description?: string | null;
  site_name?: string | null;
  author?: string | null;
  image_url?: string | null;
  favicon_url?: string | null;
  keywords?: string[];
  has_transcript?: boolean;
  indexed_chars?: number;
  error?: string | null;
}

function toIndexResult(raw: RawIndexResponse): IndexResult {
  const status =
    raw.status === 'ready' || raw.status === 'skipped' ? raw.status : 'failed';
  return {
    memoryId: raw.memory_id,
    status,
    url: raw.url ?? null,
    pageTitle: raw.page_title ?? null,
    description: raw.description ?? null,
    siteName: raw.site_name ?? null,
    author: raw.author ?? null,
    imageUrl: raw.image_url ?? null,
    faviconUrl: raw.favicon_url ?? null,
    keywords: raw.keywords ?? [],
    hasTranscript: raw.has_transcript ?? false,
    indexedChars: raw.indexed_chars ?? 0,
    error: raw.error ?? null,
  };
}

/**
 * Ask the service to open a saved link and index what it finds.
 *
 * Returns null when the service is unreachable, the token is rejected, or the
 * response is malformed — every one of which is a non-event for the caller.
 * Pass `force` to re-index a link that already has a `ready` row.
 */
export async function indexMemory(
  memoryId: string,
  sessionToken: string,
  options: { force?: boolean } = {}
): Promise<IndexResult | null> {
  // Not configured is a normal state, not an error — don't attempt a request.
  if (!INTELLIGENCE_SERVICE_URL) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INDEX_TIMEOUT_MS);

  try {
    const res = await fetch(`${INTELLIGENCE_SERVICE_URL}/index`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ memory_id: memoryId, force: options.force ?? false }),
      signal: controller.signal,
      // Indexing is a mutation against live pages — never serve it from a cache.
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[intelligence] index ${memoryId} failed: HTTP ${res.status}`);
      return null;
    }

    return toIndexResult((await res.json()) as RawIndexResponse);
  } catch (error) {
    // Service down, DNS failure, or the 20s timeout elapsed.
    const reason = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[intelligence] index ${memoryId} unavailable: ${reason}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
