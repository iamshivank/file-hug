import { MemoryData } from '../types/memory.types';

/**
 * Seed library for demo mode (`NEXT_PUBLIC_IS_DEMO_MODE=true`), which runs
 * entirely in the browser with no database and no intelligence service.
 *
 * The `enrichment` blocks are hand-written stand-ins for what the indexer
 * produces after opening each link, so the demo shows the same cards, previews and
 * search behaviour a real account gets — including one `failed` row, because a
 * library where every link read perfectly is not an honest preview.
 */
export const DEMO_MEMORIES: MemoryData[] = [
  {
    id: 'demo-1',
    // The canonical Instagram share URL uses the singular `/reel/` path.
    content: 'https://www.instagram.com/reel/C8xKj1pPa2Q/',
    type: 'url',
    title: 'Instagram Reel',
    tags: ['instagram', 'reel'],
    createdAt: '2026-06-01T10:00:00.000Z',
    enrichment: {
      status: 'ready',
      pageTitle: '3 espresso extraction mistakes — and the fix for each',
      description:
        'Grind too coarse and it runs fast and sour; too fine and it chokes. Dial in by taste, not by numbers.',
      siteName: 'Instagram',
      author: '@thecoffeelab',
      keywords: ['espresso', 'coffee', 'brewing'],
      hasTranscript: false,
      indexedChars: 640,
      fetchedAt: '2026-06-01T10:00:14.000Z',
    },
  },
  {
    id: 'demo-2',
    content: 'https://www.youtube.com/watch?v=g-G5X9VMXlQ',
    type: 'url',
    title: 'YouTube Video',
    tags: ['youtube', 'video', 'startup'],
    createdAt: '2026-06-03T14:30:00.000Z',
    enrichment: {
      status: 'ready',
      pageTitle: 'How to price a SaaS product when you have no customers yet',
      description:
        'Pricing is positioning. Start higher than feels comfortable, then earn the number with onboarding.',
      siteName: 'YouTube',
      author: 'Y Combinator',
      keywords: ['pricing', 'saas', 'startup'],
      hasTranscript: true,
      indexedChars: 18420,
      fetchedAt: '2026-06-03T14:30:09.000Z',
    },
  },
  {
    id: 'demo-3',
    content: 'https://medium.com/@startup/saas-pricing-guide-2024',
    type: 'url',
    title: 'Medium Article',
    tags: ['medium', 'article', 'saas'],
    createdAt: '2026-06-04T09:00:00.000Z',
    enrichment: {
      status: 'failed',
      error: 'Fetch failed: 403 Forbidden',
      fetchedAt: '2026-06-04T09:00:11.000Z',
    },
  },
  {
    id: 'demo-4',
    content:
      'Design inspo: Linear uses dark #030014 background with violet accents. Perfect for productivity tools — save for File Hug design doc.',
    type: 'note',
    title: 'Linear design system inspiration...',
    tags: ['design', 'inspiration'],
    linkedMemoryIds: ['demo-3'],
    createdAt: '2026-06-05T09:15:00.000Z',
  },
  {
    id: 'demo-5',
    content:
      'Batching similar tasks cuts context-switching time by ~40%. Try 90-min deep work blocks. Start tomorrow.',
    type: 'note',
    title: 'Productivity: task batching technique...',
    tags: ['productivity'],
    createdAt: '2026-06-06T08:45:00.000Z',
  },
];
