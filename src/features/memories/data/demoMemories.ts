import { MemoryData } from '../types/memory.types';

export const DEMO_MEMORIES: MemoryData[] = [
  {
    _id: 'demo-1',
    content: 'https://www.instagram.com/reels/C8xKj1pPa2Q/',
    type: 'url',
    title: 'Instagram Reel',
    tags: ['instagram', 'reel'],
    createdAt: '2026-06-01T10:00:00.000Z',
  },
  {
    _id: 'demo-2',
    content: 'https://www.youtube.com/watch?v=g-G5X9VMXlQ',
    type: 'url',
    title: 'YouTube Video',
    tags: ['youtube', 'video', 'startup'],
    createdAt: '2026-06-03T14:30:00.000Z',
  },
  {
    _id: 'demo-3',
    content: 'https://medium.com/@startup/saas-pricing-guide-2024',
    type: 'url',
    title: 'Medium Article',
    tags: ['medium', 'article', 'saas'],
    createdAt: '2026-06-04T09:00:00.000Z',
  },
  {
    _id: 'demo-4',
    content:
      'Design inspo: Linear uses dark #030014 background with violet accents. Perfect for productivity tools — save for File Hug design doc.',
    type: 'note',
    title: 'Linear design system inspiration...',
    tags: ['design', 'inspiration'],
    linkedMemoryIds: ['demo-3'],
    createdAt: '2026-06-05T09:15:00.000Z',
  },
  {
    _id: 'demo-5',
    content:
      'Batching similar tasks cuts context-switching time by ~40%. Try 90-min deep work blocks. Start tomorrow.',
    type: 'note',
    title: 'Productivity: task batching technique...',
    tags: ['productivity'],
    createdAt: '2026-06-06T08:45:00.000Z',
  },
];
