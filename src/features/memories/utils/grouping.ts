import { MemoryData } from '../types/memory.types';

/** A bucket of link memories that share a platform (or the catch-all "other"). */
export interface PlatformGroupData {
  /** Stable key for the group — the platform word, or 'other'. */
  platform: string;
  /** Human-friendly heading, e.g. "Instagram" or "Other / Websites". */
  label: string;
  memories: MemoryData[];
}

/** Platforms we render as their own named section, in the order they map here. */
const KNOWN_PLATFORMS: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  X: 'X',
  tiktok: 'TikTok',
  reddit: 'Reddit',
  github: 'GitHub',
  medium: 'Medium',
};

/** Everything that isn't a recognised platform falls into this bucket. */
const OTHER_KEY = 'other';
const OTHER_LABEL = 'Other / Websites';

/** The platform word for a link is `tags[0]`; missing/unknown ⇒ the other bucket. */
function platformKeyOf(memory: MemoryData): string {
  const tag = memory.tags.length > 0 ? memory.tags[0] : null;
  return tag && tag in KNOWN_PLATFORMS ? tag : OTHER_KEY;
}

/**
 * Groups link memories by platform. Recognised platforms each get their own
 * group; everything else collapses into a single "Other / Websites" bucket.
 * Groups are sorted by memory count descending, then by label (A→Z); the
 * "other" bucket always sorts last so named platforms lead.
 */
export function groupByPlatform(links: MemoryData[]): PlatformGroupData[] {
  const buckets = new Map<string, MemoryData[]>();

  for (const memory of links) {
    const key = platformKeyOf(memory);
    const existing = buckets.get(key);
    if (existing) existing.push(memory);
    else buckets.set(key, [memory]);
  }

  const groups: PlatformGroupData[] = [];
  for (const [platform, memories] of buckets) {
    groups.push({
      platform,
      label: platform === OTHER_KEY ? OTHER_LABEL : KNOWN_PLATFORMS[platform],
      memories,
    });
  }

  return groups.sort((a, b) => {
    // Keep the catch-all bucket last regardless of size.
    if (a.platform === OTHER_KEY) return 1;
    if (b.platform === OTHER_KEY) return -1;
    if (b.memories.length !== a.memories.length) {
      return b.memories.length - a.memories.length;
    }
    return a.label.localeCompare(b.label);
  });
}
