export interface DetectionResult {
  type: 'url' | 'note';
  platform: string | null;
  subtype: string | null;
  tags: string[];
  title: string;
  /**
   * The canonical URL to store — the input with a scheme added when it was
   * missing. Equals the trimmed input for notes and already-absolute URLs.
   */
  url: string;
}

type PlatformRule = {
  /** Matched against the *normalised* hostname (no `www.`/`m.`/`mobile.` prefix). */
  hostname: RegExp;
  platform: string;
  /** `parts` is the pathname split on `/` with empty segments removed. */
  detect: (url: URL, parts: string[]) => { subtype: string; title: string };
};

/**
 * Hosts that serve the same site under a mobile or `www` prefix. Stripping these
 * before matching means `m.instagram.com/reel/x` detects exactly like
 * `www.instagram.com/reel/x`.
 */
function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)+/, '');
}

/**
 * TLDs common enough that a scheme-less string ending in one is almost certainly
 * a link rather than prose. Used only when the input has no `/` to disambiguate
 * (see `coerceToUrl`), so a note like `TODO.md` stays a note.
 */
const COMMON_TLDS = new Set([
  'com', 'org', 'net', 'io', 'dev', 'app', 'ai', 'co', 'gg', 'so', 'sh', 'me', 'to', 'tv',
]);

/**
 * Accepts what people actually paste. Returns an absolute URL string when the
 * input looks like a link (adding `https://` when the scheme is missing), or
 * null when it should be treated as a note.
 */
function coerceToUrl(input: string): string | null {
  if (/\s/.test(input)) return null; // prose, not a URL

  if (/^https?:\/\//i.test(input)) return input;
  // Any other explicit scheme (mailto:, javascript:, file:, …) is not a web link.
  if (/^[a-z][a-z0-9+.-]*:/i.test(input)) return null;

  const hostPart = input.split(/[/?#]/)[0];
  const labels = hostPart.split('.');
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return null;

  const tld = labels[labels.length - 1].toLowerCase();
  if (!/^[a-z]{2,}$/.test(tld)) return null;

  // With a path (`instagram.com/reel/x`) the intent is unambiguous. Without one
  // we only accept well-known TLDs so filenames like `notes.md` remain notes.
  const hasPath = input.length > hostPart.length;
  if (!hasPath && !COMMON_TLDS.has(tld)) return null;

  return `https://${input}`;
}

const PLATFORM_RULES: PlatformRule[] = [
  {
    hostname: /^instagram\.com$/,
    platform: 'instagram',
    detect(url, parts) {
      // Instagram serves reels under BOTH `/reel/{code}` (the canonical share
      // URL) and `/reels/{code}`, and also under `/{username}/reel/{code}`.
      // Missing the singular form is why reels used to read as profiles.
      const kinds = new Set(parts);
      if (kinds.has('reel') || kinds.has('reels')) {
        return { subtype: 'reel', title: 'Instagram Reel' };
      }
      if (kinds.has('p')) return { subtype: 'post', title: 'Instagram Post' };
      if (kinds.has('tv')) return { subtype: 'video', title: 'Instagram Video' };
      if (kinds.has('stories')) return { subtype: 'story', title: 'Instagram Story' };
      if (parts[0] === 'explore') return { subtype: 'explore', title: 'Instagram Explore' };
      // `/share/{code}` is an opaque redirect — the real kind is only known once
      // the intelligence service follows it, so stay neutral rather than guess.
      if (parts[0] === 'share') return { subtype: 'link', title: 'Instagram Link' };
      return { subtype: 'profile', title: 'Instagram Profile' };
    },
  },
  {
    hostname: /^youtube\.com$/,
    platform: 'youtube',
    detect(url, parts) {
      if (url.pathname === '/watch') return { subtype: 'video', title: 'YouTube Video' };
      if (parts[0] === 'shorts') return { subtype: 'shorts', title: 'YouTube Short' };
      if (parts[0] === 'live') return { subtype: 'live', title: 'YouTube Live' };
      if (parts[0] === 'playlist') return { subtype: 'playlist', title: 'YouTube Playlist' };
      if (parts[0] === 'channel' || parts[0] === 'c' || parts[0]?.startsWith('@')) {
        return { subtype: 'channel', title: 'YouTube Channel' };
      }
      return { subtype: 'video', title: 'YouTube' };
    },
  },
  {
    hostname: /^youtu\.be$/,
    platform: 'youtube',
    detect() {
      return { subtype: 'video', title: 'YouTube Video' };
    },
  },
  {
    hostname: /^(twitter|x)\.com$/,
    platform: 'X',
    detect(url, parts) {
      if (parts.includes('status')) return { subtype: 'tweet', title: 'Tweet' };
      if (parts[0] === 'i' && parts[1] === 'lists') return { subtype: 'list', title: 'X List' };
      return { subtype: 'profile', title: 'X Profile' };
    },
  },
  {
    hostname: /^tiktok\.com$/,
    platform: 'tiktok',
    detect(url, parts) {
      if (parts.includes('video')) return { subtype: 'video', title: 'TikTok Video' };
      // Short share links: tiktok.com/t/{code}
      if (parts[0] === 't') return { subtype: 'video', title: 'TikTok Video' };
      return { subtype: 'profile', title: 'TikTok Profile' };
    },
  },
  {
    hostname: /^vm\.tiktok\.com$/,
    platform: 'tiktok',
    detect() {
      return { subtype: 'video', title: 'TikTok Video' };
    },
  },
  {
    hostname: /^reddit\.com$/,
    platform: 'reddit',
    detect(url, parts) {
      if (parts[0] === 'r' && parts.includes('comments')) {
        return { subtype: 'post', title: 'Reddit Post' };
      }
      if (parts[0] === 'r') return { subtype: 'community', title: 'Reddit Community' };
      if (parts[0] === 'user' || parts[0] === 'u') {
        return { subtype: 'profile', title: 'Reddit Profile' };
      }
      return { subtype: 'post', title: 'Reddit' };
    },
  },
  {
    hostname: /^github\.com$/,
    platform: 'github',
    detect(url, parts) {
      if (parts.length >= 3 && parts[2] === 'issues') {
        return { subtype: 'issue', title: 'GitHub Issue' };
      }
      if (parts.length >= 3 && parts[2] === 'pull') {
        return { subtype: 'pr', title: 'GitHub Pull Request' };
      }
      if (parts.length >= 2) return { subtype: 'repo', title: 'GitHub Repository' };
      return { subtype: 'profile', title: 'GitHub Profile' };
    },
  },
  {
    hostname: /^gist\.github\.com$/,
    platform: 'github',
    detect() {
      return { subtype: 'gist', title: 'GitHub Gist' };
    },
  },
  {
    hostname: /^medium\.com$/,
    platform: 'medium',
    detect() {
      return { subtype: 'article', title: 'Medium Article' };
    },
  },
  {
    hostname: /^linkedin\.com$/,
    platform: 'linkedin',
    detect(url, parts) {
      if (parts[0] === 'posts') return { subtype: 'post', title: 'LinkedIn Post' };
      if (parts[0] === 'pulse') return { subtype: 'article', title: 'LinkedIn Article' };
      if (parts[0] === 'in') return { subtype: 'profile', title: 'LinkedIn Profile' };
      if (parts[0] === 'company') return { subtype: 'company', title: 'LinkedIn Company' };
      if (parts[0] === 'jobs') return { subtype: 'job', title: 'LinkedIn Job' };
      return { subtype: 'post', title: 'LinkedIn' };
    },
  },
  {
    hostname: /^threads\.(net|com)$/,
    platform: 'threads',
    detect(url, parts) {
      if (parts.includes('post')) return { subtype: 'post', title: 'Threads Post' };
      return { subtype: 'profile', title: 'Threads Profile' };
    },
  },
  {
    hostname: /^(facebook\.com|fb\.watch)$/,
    platform: 'facebook',
    detect(url, parts) {
      if (parts.includes('reel') || parts.includes('reels')) {
        return { subtype: 'reel', title: 'Facebook Reel' };
      }
      if (parts.includes('videos') || parts[0] === 'watch') {
        return { subtype: 'video', title: 'Facebook Video' };
      }
      if (parts.includes('posts')) return { subtype: 'post', title: 'Facebook Post' };
      if (parts[0] === 'groups') return { subtype: 'group', title: 'Facebook Group' };
      return { subtype: 'post', title: 'Facebook' };
    },
  },
  {
    hostname: /^pinterest\.[a-z.]+$/,
    platform: 'pinterest',
    detect(url, parts) {
      if (parts[0] === 'pin') return { subtype: 'pin', title: 'Pinterest Pin' };
      return { subtype: 'board', title: 'Pinterest Board' };
    },
  },
  {
    hostname: /^(open\.spotify\.com|spotify\.link)$/,
    platform: 'spotify',
    detect(url, parts) {
      const kind = parts[0] === 'intl-en' ? parts[1] : parts[0];
      switch (kind) {
        case 'track':
          return { subtype: 'track', title: 'Spotify Track' };
        case 'album':
          return { subtype: 'album', title: 'Spotify Album' };
        case 'playlist':
          return { subtype: 'playlist', title: 'Spotify Playlist' };
        case 'episode':
          return { subtype: 'episode', title: 'Spotify Podcast Episode' };
        case 'show':
          return { subtype: 'show', title: 'Spotify Podcast' };
        case 'artist':
          return { subtype: 'artist', title: 'Spotify Artist' };
        default:
          return { subtype: 'track', title: 'Spotify' };
      }
    },
  },
  {
    hostname: /(^|\.)substack\.com$/,
    platform: 'substack',
    detect(url, parts) {
      if (parts[0] === 'p') return { subtype: 'article', title: 'Substack Post' };
      return { subtype: 'newsletter', title: 'Substack Newsletter' };
    },
  },
  {
    hostname: /^(notion\.so|notion\.site|.+\.notion\.site)$/,
    platform: 'notion',
    detect() {
      return { subtype: 'page', title: 'Notion Page' };
    },
  },
  {
    hostname: /^(chat\.openai\.com|chatgpt\.com)$/,
    platform: 'chatgpt',
    detect(url, parts) {
      if (parts[0] === 'share') return { subtype: 'conversation', title: 'ChatGPT Conversation' };
      if (parts[0] === 'g') return { subtype: 'gpt', title: 'Custom GPT' };
      return { subtype: 'conversation', title: 'ChatGPT' };
    },
  },
  {
    hostname: /^claude\.ai$/,
    platform: 'claude',
    detect(url, parts) {
      if (parts[0] === 'share') return { subtype: 'conversation', title: 'Claude Conversation' };
      if (parts[0] === 'artifacts') return { subtype: 'artifact', title: 'Claude Artifact' };
      return { subtype: 'conversation', title: 'Claude' };
    },
  },
  {
    hostname: /^(twitch\.tv|clips\.twitch\.tv)$/,
    platform: 'twitch',
    detect(url, parts) {
      if (parts[0] === 'videos') return { subtype: 'video', title: 'Twitch Video' };
      if (parts.includes('clip') || url.hostname.startsWith('clips.')) {
        return { subtype: 'clip', title: 'Twitch Clip' };
      }
      return { subtype: 'channel', title: 'Twitch Channel' };
    },
  },
  {
    hostname: /^vimeo\.com$/,
    platform: 'vimeo',
    detect() {
      return { subtype: 'video', title: 'Vimeo Video' };
    },
  },
  {
    hostname: /^dev\.to$/,
    platform: 'devto',
    detect() {
      return { subtype: 'article', title: 'DEV Article' };
    },
  },
  {
    hostname: /^stackoverflow\.com$/,
    platform: 'stackoverflow',
    detect(url, parts) {
      if (parts[0] === 'questions') return { subtype: 'question', title: 'Stack Overflow Question' };
      return { subtype: 'question', title: 'Stack Overflow' };
    },
  },
  {
    hostname: /^news\.ycombinator\.com$/,
    platform: 'hackernews',
    detect() {
      return { subtype: 'post', title: 'Hacker News Thread' };
    },
  },
  {
    hostname: /^arxiv\.org$/,
    platform: 'arxiv',
    detect() {
      return { subtype: 'paper', title: 'arXiv Paper' };
    },
  },
  {
    hostname: /(^|\.)wikipedia\.org$/,
    platform: 'wikipedia',
    detect() {
      return { subtype: 'article', title: 'Wikipedia Article' };
    },
  },
  {
    hostname: /^docs\.google\.com$/,
    platform: 'docs',
    detect(url, parts) {
      switch (parts[0]) {
        case 'spreadsheets':
          return { subtype: 'sheet', title: 'Google Sheet' };
        case 'presentation':
          return { subtype: 'slides', title: 'Google Slides' };
        case 'forms':
          return { subtype: 'form', title: 'Google Form' };
        default:
          return { subtype: 'doc', title: 'Google Doc' };
      }
    },
  },
  {
    hostname: /^figma\.com$/,
    platform: 'figma',
    detect(url, parts) {
      if (parts[0] === 'proto') return { subtype: 'prototype', title: 'Figma Prototype' };
      return { subtype: 'file', title: 'Figma File' };
    },
  },
  {
    hostname: /^dribbble\.com$/,
    platform: 'dribbble',
    detect(url, parts) {
      if (parts[0] === 'shots') return { subtype: 'shot', title: 'Dribbble Shot' };
      return { subtype: 'shot', title: 'Dribbble' };
    },
  },
  {
    hostname: /^producthunt\.com$/,
    platform: 'producthunt',
    detect(url, parts) {
      if (parts[0] === 'posts') return { subtype: 'launch', title: 'Product Hunt Launch' };
      return { subtype: 'launch', title: 'Product Hunt' };
    },
  },
];

export function detectContent(content: string): DetectionResult {
  const trimmed = content.trim();

  const candidate = coerceToUrl(trimmed);
  let url: URL | null = null;
  if (candidate) {
    try {
      url = new URL(candidate);
    } catch {
      url = null;
    }
  }

  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    const title = trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
    return { type: 'note', platform: null, subtype: null, tags: [], title, url: trimmed };
  }

  const hostname = normalizeHostname(url.hostname);
  const parts = url.pathname.split('/').filter(Boolean);

  for (const rule of PLATFORM_RULES) {
    if (rule.hostname.test(hostname)) {
      const { subtype, title } = rule.detect(url, parts);
      return {
        type: 'url',
        platform: rule.platform,
        subtype,
        tags: [rule.platform, subtype],
        title,
        url: url.toString(),
      };
    }
  }

  return {
    type: 'url',
    platform: null,
    subtype: null,
    tags: [hostname.split('.')[0]],
    title: hostname,
    url: url.toString(),
  };
}
