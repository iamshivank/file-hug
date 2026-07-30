import { MemoryData } from '../types/memory.types';

/**
 * The platform word for a link memory is `tags[0]` (instagram/youtube/X/… or a
 * hostname-derived word for other sites). Notes have no meaningful platform.
 */
function platformOf(memory: MemoryData): string | null {
  return memory.type === 'url' && memory.tags.length > 0 ? memory.tags[0] : null;
}

/**
 * Case-insensitive match of a memory against a free-text query.
 *
 * Searches the title, content, tags, derived platform word, **and** whatever the
 * indexer learned by opening the link (real page title, description, site name,
 * author, keywords). That last part is why "pricing" can find a saved article
 * whose URL is an opaque slug, even without the intelligence service running.
 *
 * The full body text and transcript are matched server-side only — they are never
 * shipped to the browser — so this is a narrower search than `/api/intelligence/search`.
 * An empty/blank query matches everything.
 */
export function matchesQuery(memory: MemoryData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystacks: string[] = [memory.title, memory.content, ...memory.tags];

  const platform = platformOf(memory);
  if (platform) haystacks.push(platform);

  const enrichment = memory.enrichment;
  if (enrichment) {
    for (const value of [
      enrichment.pageTitle,
      enrichment.description,
      enrichment.siteName,
      enrichment.author,
      ...(enrichment.keywords ?? []),
    ]) {
      if (value) haystacks.push(value);
    }
  }

  return haystacks.some((value) => value.toLowerCase().includes(q));
}

/** Filters a list of memories by the query, preserving order. */
export function filterMemories(memories: MemoryData[], query: string): MemoryData[] {
  const q = query.trim();
  if (!q) return memories;
  return memories.filter((memory) => matchesQuery(memory, q));
}

/**
 * Reorder `memories` to match a ranked list of ids from the server, dropping
 * anything the server did not return.
 *
 * The server ranks ids; the client already holds the full memory objects, so this
 * avoids re-shipping them and keeps whatever local edits are in flight.
 */
export function applyRanking(memories: MemoryData[], rankedIds: string[]): MemoryData[] {
  const byId = new Map(memories.map((memory) => [memory.id, memory]));
  const ranked: MemoryData[] = [];
  for (const id of rankedIds) {
    const memory = byId.get(id);
    if (memory) ranked.push(memory);
  }
  return ranked;
}
