/**
 * Shared, three-free contract between the hero's DOM layer (HeroExperience)
 * and its lazily-loaded WebGL scene (HeroScene). Kept free of `three` imports
 * so the DOM half never pulls the 3D bundle into first paint.
 */

export type CardKind = 'reel' | 'article' | 'chat' | 'meme' | 'link' | 'note';

type Vec3 = readonly [number, number, number];

export interface CardSpec {
  kind: CardKind;
  /** Short name used on the keyboard chips and in the toast. */
  label: string;
  /** Where it came from — shown in the "saved" toast. */
  source: string;
  /** What the intelligence service pulled out of it — shown in the toast. */
  indexed: string;
  /** Card face size in world units (before layout scale). */
  size: readonly [number, number];
  /** Resting position around the vault on wide screens. */
  home: Vec3;
  /** Resting position on portrait / narrow screens. */
  homeNarrow: Vec3;
  /** Resting rotation (radians). */
  rot: Vec3;
}

export const CARD_SPECS: Record<CardKind, CardSpec> = {
  reel: {
    kind: 'reel',
    label: 'Reel',
    source: 'Instagram',
    indexed: 'transcript · 214 words',
    size: [1.12, 2],
    home: [-2.3, 0.72, 0.6],
    homeNarrow: [-1.02, 0.78, 0.5],
    rot: [0.04, 0.38, -0.07],
  },
  article: {
    kind: 'article',
    label: 'Article',
    source: 'longreads.com',
    indexed: 'full text · 3,180 words',
    size: [2.04, 1.44],
    home: [2.42, 1.12, -0.4],
    homeNarrow: [1.06, 1.08, -0.6],
    rot: [-0.06, -0.42, 0.05],
  },
  chat: {
    kind: 'chat',
    label: 'ChatGPT chat',
    source: 'chatgpt.com',
    indexed: 'conversation · 6 turns',
    size: [1.46, 1.84],
    home: [-2.22, -1.48, -0.2],
    homeNarrow: [-1.06, -1.32, -0.3],
    rot: [0.08, 0.3, 0.06],
  },
  meme: {
    kind: 'meme',
    label: 'Meme',
    source: 'x.com',
    indexed: 'image text · 2 keywords',
    size: [1.46, 1.46],
    home: [2.22, -1.32, 0.75],
    homeNarrow: [1.02, -1.18, 0.6],
    rot: [0.05, -0.34, -0.05],
  },
  link: {
    kind: 'link',
    label: 'Link',
    source: 'github.com',
    indexed: 'readme · 12 keywords',
    size: [1.9, 1.02],
    home: [-0.12, 2.18, -1.3],
    homeNarrow: [0, 2.35, -1.4],
    rot: [0.12, 0.08, 0.03],
  },
  note: {
    kind: 'note',
    label: 'Note',
    source: 'your notes',
    indexed: 'linked to 1 reel',
    size: [1.36, 1.36],
    home: [0.12, -2.18, -1],
    homeNarrow: [0, -2.7, -1],
    rot: [-0.12, -0.06, 0.04],
  },
};

/** Every card, desktop order. */
export const ALL_KINDS: readonly CardKind[] = ['reel', 'article', 'chat', 'meme', 'link', 'note'];
/** The lighter set rendered on phones and touch-first devices. */
export const COMPACT_KINDS: readonly CardKind[] = ['reel', 'article', 'chat', 'meme'];

/** The memory the scripted search finds. */
export const FEATURED_KIND: CardKind = 'reel';
export const SEARCH_QUERY = 'that sourdough reel from last month';

/** Scroll progress values that sit squarely inside each phase. */
export const PHASE_PROGRESS = [0.04, 0.5, 0.97] as const;

export const PHASES = [
  { id: 'capture', label: 'Capture' },
  { id: 'index', label: 'Index' },
  { id: 'recall', label: 'Recall' },
] as const;

export function phaseFor(progress: number): 0 | 1 | 2 {
  if (progress < 0.33) return 0;
  if (progress < 0.62) return 1;
  return 2;
}

/** Hermite smoothstep, clamped. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Mutable state shared by the DOM overlay and the render loop. Lives in a ref:
 * the scroll handler and keyboard chips write it, `useFrame` reads it, and no
 * React render ever depends on it.
 */
export interface HeroStore {
  /** 0 → 1 across the pinned hero. */
  progress: number;
  /** Card index highlighted from the DOM (hover/focus on a chip), or -1. */
  focus: number;
  /** Card indices the DOM asked to save into the vault. */
  absorbQueue: number[];
  /** True while a card is held — lets touch input block page scroll. */
  grabbing: boolean;
  /** Element whose `data-cursor` reflects grab state. */
  cursorTarget: HTMLElement | null;
  /** Requests a frame when the canvas renders on demand (reduced motion). */
  invalidate: () => void;
}

export function createHeroStore(): HeroStore {
  return {
    progress: 0,
    focus: -1,
    absorbQueue: [],
    grabbing: false,
    cursorTarget: null,
    invalidate: () => {},
  };
}
