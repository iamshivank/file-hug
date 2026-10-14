/**
 * A tiny in-browser imitation of File Hug's ranking, for the landing demo only.
 * The real thing is hybrid semantic + full-text search in the intelligence
 * service; here a synonym table stands in for "meaning".
 */

export interface DemoMemory {
  id: string;
  kindLabel: string;
  /** Key understood by PlatformIcon (null = generic link). */
  platform: string | null;
  type: 'url' | 'note';
  title: string;
  source: string;
  daysAgo: number;
  tags: string[];
  indexedLabel: string;
  indexed: string;
  keywords: string[];
}

export const DEMO_MEMORIES: DemoMemory[] = [
  {
    id: 'm1',
    kindLabel: 'Reel',
    platform: 'instagram',
    type: 'url',
    title: '72-hour sourdough, the lazy way',
    source: '@wildyeast.co',
    daysAgo: 23,
    tags: ['baking', 'weekend'],
    indexedLabel: 'transcript',
    indexed: 'feed your levain the night before then cold proof it in the fridge for 72 hours and bake straight from cold for an open crumb',
    keywords: ['sourdough', 'bread', 'recipe', 'baking', 'food', 'cook', 'video'],
  },
  {
    id: 'm2',
    kindLabel: 'Article',
    platform: null,
    type: 'url',
    title: 'The small-web renaissance',
    source: 'longreads.com',
    daysAgo: 61,
    tags: ['research', 'web'],
    indexedLabel: 'page text',
    indexed: 'personal websites rss feeds and hand made blogs are quietly coming back as people leave algorithmic timelines',
    keywords: ['internet', 'blog', 'essay', 'indie', 'read'],
  },
  {
    id: 'm3',
    kindLabel: 'ChatGPT chat',
    platform: 'chatgpt',
    type: 'url',
    title: 'Pricing a SaaS for India',
    source: 'chatgpt.com',
    daysAgo: 6,
    tags: ['startup'],
    indexedLabel: 'conversation',
    indexed: 'lead with a generous free tier then anchor pro at 99 rupees a month price in rupees not dollars and avoid annual lock in',
    keywords: ['pricing', 'price', 'money', 'business', 'app', 'subscription', 'ai'],
  },
  {
    id: 'm4',
    kindLabel: 'Meme',
    platform: 'X',
    type: 'url',
    title: '214 tabs and scared to close any of them',
    source: '@tabhoarder',
    daysAgo: 1,
    tags: ['lol'],
    indexedLabel: 'image text',
    indexed: 'me with 214 tabs open too scared to close a single one because one of them is important',
    keywords: ['funny', 'meme', 'joke', 'browser', 'tabs'],
  },
  {
    id: 'm5',
    kindLabel: 'Repo',
    platform: 'github',
    type: 'url',
    title: 'tiny-shaders: 60 GLSL shaders under 280 characters',
    source: 'github.com/nightowl',
    daysAgo: 4,
    tags: ['webgl', 'inspiration'],
    indexedLabel: 'readme',
    indexed: 'a pocket collection of noise light and water studies you can paste into any webgl or three js scene',
    keywords: ['code', 'graphics', '3d', 'shader', 'design', 'animation'],
  },
  {
    id: 'm6',
    kindLabel: 'Note',
    platform: null,
    type: 'note',
    title: 'Gift ideas for Anya',
    source: 'your note',
    daysAgo: 12,
    tags: ['birthday'],
    indexedLabel: 'note',
    indexed: 'ceramic pour over from that reel kyoto pocket guidebook linen apron in rust',
    keywords: ['gift', 'present', 'shopping', 'buy', 'friend'],
  },
  {
    id: 'm7',
    kindLabel: 'Video',
    platform: 'youtube',
    type: 'url',
    title: 'Japanese joinery without a single nail',
    source: 'youtube.com',
    daysAgo: 34,
    tags: ['woodworking'],
    indexedLabel: 'transcript',
    indexed: 'cut the mortise first then pare the tenon with a sharp chisel until it slides in with hand pressure',
    keywords: ['wood', 'craft', 'diy', 'video', 'build'],
  },
  {
    id: 'm8',
    kindLabel: 'Thread',
    platform: 'reddit',
    type: 'url',
    title: 'Budget mechanical keyboard that feels premium?',
    source: 'r/MechanicalKeyboards',
    daysAgo: 5,
    tags: ['buy later'],
    indexedLabel: 'page text',
    indexed: 'gasket mount boards under 6000 rupees with pre lubed linear switches sound far better than their price',
    keywords: ['keyboard', 'desk', 'setup', 'cheap', 'shopping', 'buy'],
  },
  {
    id: 'm9',
    kindLabel: 'Playlist',
    platform: 'spotify',
    type: 'url',
    title: 'Deep focus: lo-fi for late nights',
    source: 'open.spotify.com',
    daysAgo: 48,
    tags: ['focus'],
    indexedLabel: 'page text',
    indexed: 'three hours of mellow beats for studying coding and writing without lyrics',
    keywords: ['music', 'study', 'playlist', 'work', 'calm'],
  },
  {
    id: 'm10',
    kindLabel: 'Article',
    platform: 'medium',
    type: 'url',
    title: 'How we cut our cloud bill by 40%',
    source: 'medium.com',
    daysAgo: 8,
    tags: ['work'],
    indexedLabel: 'page text',
    indexed: 'rightsizing instances moving cold logs to cheaper storage and killing idle preview environments saved us money every month',
    keywords: ['aws', 'cost', 'money', 'infrastructure', 'engineering'],
  },
  {
    id: 'm11',
    kindLabel: 'Video',
    platform: 'tiktok',
    type: 'url',
    title: '15-minute chili crisp noodles',
    source: '@noodlenights',
    daysAgo: 3,
    tags: ['cook later'],
    indexedLabel: 'transcript',
    indexed: 'toss hot noodles with chili crisp soy black vinegar and a little peanut butter then top with spring onion',
    keywords: ['recipe', 'food', 'dinner', 'spicy', 'cook', 'quick', 'video'],
  },
  {
    id: 'm12',
    kindLabel: 'Note',
    platform: null,
    type: 'note',
    title: 'Goa in December',
    source: 'your note',
    daysAgo: 1,
    tags: ['travel'],
    indexedLabel: 'note',
    indexed: 'book the beach shack early rent a scooter and do the fontainhas walk on the first morning',
    keywords: ['trip', 'vacation', 'holiday', 'beach', 'plan'],
  },
];

const STOP = new Set(
  'a an the that this those these about from of for in on to my me i with and or was is it its some something thing things what which where when how who saved save find should could would can do did there one any really'.split(
    ' '
  )
);

const SYNONYMS: Record<string, string[]> = {
  bread: ['sourdough', 'baking'],
  bake: ['baking', 'sourdough'],
  cook: ['recipe', 'food', 'dinner'],
  cooking: ['recipe', 'food'],
  recipe: ['cook', 'food'],
  food: ['recipe', 'cook', 'dinner'],
  eat: ['food', 'dinner', 'recipe'],
  dinner: ['food', 'recipe'],
  tonight: ['dinner', 'quick'],
  video: ['reel', 'youtube', 'tiktok'],
  reel: ['video', 'instagram'],
  funny: ['meme', 'joke'],
  lol: ['funny', 'meme'],
  meme: ['funny'],
  money: ['pricing', 'cost'],
  price: ['pricing', 'money'],
  charge: ['pricing', 'price'],
  saas: ['startup', 'subscription', 'pricing'],
  ai: ['chatgpt'],
  chat: ['chatgpt', 'conversation'],
  music: ['playlist', 'spotify'],
  song: ['music', 'playlist'],
  study: ['focus', 'music'],
  trip: ['travel', 'vacation'],
  travel: ['trip', 'vacation'],
  holiday: ['travel', 'vacation', 'beach'],
  gift: ['present', 'birthday'],
  present: ['gift'],
  birthday: ['gift'],
  code: ['github', 'engineering'],
  shader: ['webgl', 'graphics'],
  '3d': ['webgl', 'graphics', 'shader'],
  inspiration: ['design', 'webgl'],
  wood: ['woodworking', 'joinery'],
  keyboard: ['desk', 'setup'],
  cloud: ['aws', 'infrastructure'],
  cheap: ['budget', 'cost'],
  tab: ['tabs', 'browser'],
};

type TimeWindow = { label: string; min: number; max: number };

const TIME_PHRASES: { re: RegExp; window: TimeWindow }[] = [
  { re: /\b(today|yesterday)\b/, window: { label: 'saved yesterday', min: 0, max: 1 } },
  { re: /\b(last|this|past) week\b|\brecent(ly)?\b/, window: { label: 'saved last week', min: 0, max: 8 } },
  { re: /\b(last|this|past) month\b/, window: { label: 'saved last month', min: 9, max: 45 } },
];

function stem(word: string): string {
  for (const suffix of ['ing', 'ed', 'es', 's', 'e']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) return word.slice(0, -suffix.length);
  }
  return word;
}

function words(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function matches(fieldWords: string[], term: string): string | null {
  const t = stem(term);
  for (const w of fieldWords) {
    const s = stem(w);
    if (s === t || (t.length >= 3 && s.startsWith(t))) return w;
  }
  return null;
}

export interface DemoHit {
  memory: DemoMemory;
  score: number;
  reasons: string[];
  snippet: { before: string; match: string; after: string } | null;
}

export function searchMemories(raw: string): DemoHit[] {
  let q = raw.toLowerCase().trim();
  if (!q) {
    return [...DEMO_MEMORIES]
      .sort((a, b) => a.daysAgo - b.daysAgo)
      .map((memory) => ({ memory, score: 0, reasons: [], snippet: null }));
  }

  let time: TimeWindow | null = null;
  for (const phrase of TIME_PHRASES) {
    if (phrase.re.test(q)) {
      time = phrase.window;
      q = q.replace(phrase.re, ' ');
      break;
    }
  }

  const terms = words(q).filter((w) => !STOP.has(w));
  const hits: DemoHit[] = [];

  for (const memory of DEMO_MEMORIES) {
    const fields = {
      title: words(memory.title),
      tags: words(memory.tags.join(' ')),
      kind: words(`${memory.kindLabel} ${memory.platform ?? ''} ${memory.source}`),
      topic: memory.keywords,
      indexed: words(memory.indexed),
    };
    let score = 0;
    let matchedTerms = 0;
    const reasons = new Set<string>();
    let snippetWord: string | null = null;

    for (const term of terms) {
      const variants: [string, number][] = [[term, 1], ...(SYNONYMS[term] ?? []).map((v): [string, number] => [v, 0.7])];
      let best = 0;
      let reason = '';
      for (const [variant, weight] of variants) {
        const checks: [string[], number, string][] = [
          [fields.title, 3, 'title'],
          [fields.tags, 2.6, 'your tags'],
          [fields.kind, 2.4, 'type'],
          [fields.topic, 2.1, 'topic'],
          [fields.indexed, 1.7, memory.indexedLabel],
        ];
        for (const [field, value, label] of checks) {
          const hit = matches(field, variant);
          if (hit && value * weight > best) {
            best = value * weight;
            reason = label;
            if (field === fields.indexed && !snippetWord) snippetWord = hit;
          }
        }
        if (!snippetWord) {
          const hit = matches(fields.indexed, variant);
          if (hit) snippetWord = hit;
        }
      }
      if (best > 0) {
        matchedTerms++;
        score += best;
        reasons.add(reason);
      }
    }

    if (terms.length) score += (matchedTerms / terms.length) * 2;

    if (time) {
      const inWindow = memory.daysAgo >= time.min && memory.daysAgo <= time.max;
      if (inWindow) {
        score += terms.length ? 2.5 : 3;
        reasons.add(time.label);
      } else {
        score *= 0.3;
      }
    }

    if (score < 2) continue;

    let snippet: DemoHit['snippet'] = null;
    if (snippetWord) {
      const list = memory.indexed.split(' ');
      const at = list.indexOf(snippetWord);
      if (at >= 0) {
        snippet = {
          before: list.slice(Math.max(0, at - 5), at).join(' '),
          match: snippetWord,
          after: list.slice(at + 1, at + 7).join(' '),
        };
      }
    }

    hits.push({ memory, score, reasons: [...reasons], snippet });
  }

  return hits.sort((a, b) => b.score - a.score);
}

export function agoLabel(days: number): string {
  if (days <= 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  if (days < 60) return 'last month';
  return `${Math.round(days / 30)} months ago`;
}
