import { MemoryData } from '../types/memory.types';

/** `relevance` keeps the search ranking; it only means something while searching. */
export type SortKey = 'relevance' | 'newest' | 'oldest' | 'updated' | 'title';

export const SORT_OPTIONS: { key: SortKey; label: string; searchOnly?: boolean }[] = [
  { key: 'relevance', label: 'Best match', searchOnly: true },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
  { key: 'updated', label: 'Recently edited' },
  { key: 'title', label: 'Title A–Z' },
];

const time = (value: string | Date | undefined): number => (value ? new Date(value).getTime() : 0);

/**
 * Order memories for display. Returns a new array; the input (often the search
 * ranking) is left untouched, so `relevance` is simply "as given".
 */
export function sortMemories(memories: MemoryData[], key: SortKey): MemoryData[] {
  if (key === 'relevance') return memories;
  const sorted = [...memories];
  switch (key) {
    case 'newest':
      return sorted.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    case 'oldest':
      return sorted.sort((a, b) => time(a.createdAt) - time(b.createdAt));
    case 'updated':
      return sorted.sort(
        (a, b) => time(b.updatedAt ?? b.createdAt) - time(a.updatedAt ?? a.createdAt)
      );
    case 'title':
      return sorted.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true })
      );
  }
}
