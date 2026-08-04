/**
 * Single source of truth for the platforms File Hug recognises.
 *
 * A platform *key* is what gets stored in `memories.tags[0]` for a link, so keys
 * are part of the persisted data and must not be renamed casually (`X` is
 * capitalised for exactly that reason — it predates this registry).
 *
 * Detection rules live in `urlDetection.ts`, icons in `PlatformIcon.tsx`, and
 * group headings come from `grouping.ts` — all three read their labels from here
 * so a new platform only needs one entry plus a detection rule.
 */

export interface PlatformMeta {
  /** Heading/label shown in the UI. */
  label: string;
  /**
   * Whether `PlatformIcon` has a hand-drawn glyph for this platform. Platforms
   * without one render the generic link glyph — still grouped and labelled.
   */
  hasIcon: boolean;
}

export const PLATFORMS: Record<string, PlatformMeta> = {
  instagram: { label: 'Instagram', hasIcon: true },
  youtube: { label: 'YouTube', hasIcon: true },
  X: { label: 'X', hasIcon: true },
  tiktok: { label: 'TikTok', hasIcon: true },
  reddit: { label: 'Reddit', hasIcon: true },
  github: { label: 'GitHub', hasIcon: true },
  medium: { label: 'Medium', hasIcon: true },
  linkedin: { label: 'LinkedIn', hasIcon: true },
  threads: { label: 'Threads', hasIcon: false },
  facebook: { label: 'Facebook', hasIcon: false },
  pinterest: { label: 'Pinterest', hasIcon: false },
  spotify: { label: 'Spotify', hasIcon: true },
  substack: { label: 'Substack', hasIcon: false },
  notion: { label: 'Notion', hasIcon: false },
  chatgpt: { label: 'ChatGPT', hasIcon: true },
  claude: { label: 'Claude', hasIcon: true },
  twitch: { label: 'Twitch', hasIcon: false },
  vimeo: { label: 'Vimeo', hasIcon: false },
  devto: { label: 'DEV', hasIcon: false },
  stackoverflow: { label: 'Stack Overflow', hasIcon: false },
  hackernews: { label: 'Hacker News', hasIcon: false },
  arxiv: { label: 'arXiv', hasIcon: false },
  wikipedia: { label: 'Wikipedia', hasIcon: false },
  docs: { label: 'Google Docs', hasIcon: false },
  figma: { label: 'Figma', hasIcon: false },
  dribbble: { label: 'Dribbble', hasIcon: false },
  producthunt: { label: 'Product Hunt', hasIcon: false },
};

/** True when `key` is a platform we render as its own named section. */
export function isKnownPlatform(key: string | null | undefined): boolean {
  return !!key && key in PLATFORMS;
}

/** Display label for a platform key, falling back to the key itself. */
export function platformLabel(key: string | null | undefined): string {
  if (!key) return 'Link';
  return PLATFORMS[key]?.label ?? key;
}
