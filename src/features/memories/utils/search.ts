import { MemoryData } from '../types/memory.types';

/**
 * The platform word for a link memory is `tags[0]` (instagram/youtube/X/… or a
 * hostname-derived word for other sites). Notes have no meaningful platform.
 */
function platformOf(memory: MemoryData): string | null {
  return memory.type === 'url' && memory.tags.length > 0 ? memory.tags[0] : null;
}

/**
 * Case-insensitive match of a memory against a free-text query, across the
 * title, content, tags, and the derived platform word. An empty/blank query
 * matches everything.
 */
export function matchesQuery(memory: MemoryData, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystacks: string[] = [
    memory.title,
    memory.content,
    ...memory.tags,
  ];

  const platform = platformOf(memory);
  if (platform) haystacks.push(platform);

  return haystacks.some((value) => value.toLowerCase().includes(q));
}

/** Filters a list of memories by the query, preserving order. */
export function filterMemories(memories: MemoryData[], query: string): MemoryData[] {
  const q = query.trim();
  if (!q) return memories;
  return memories.filter((memory) => matchesQuery(memory, q));
}
