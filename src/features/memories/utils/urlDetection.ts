export interface DetectionResult {
  type: 'url' | 'note';
  platform: string | null;
  subtype: string | null;
  tags: string[];
  title: string;
}

type PlatformRule = {
  hostname: RegExp;
  platform: string;
  detect: (url: URL) => { subtype: string; title: string };
};

const PLATFORM_RULES: PlatformRule[] = [
  {
    hostname: /^(www\.)?instagram\.com$/,
    platform: 'instagram',
    detect(url) {
      const p = url.pathname;
      if (p.startsWith('/reels/')) return { subtype: 'reel', title: 'Instagram Reel' };
      if (p.startsWith('/p/')) return { subtype: 'post', title: 'Instagram Post' };
      if (p.startsWith('/tv/')) return { subtype: 'video', title: 'Instagram Video' };
      if (p.startsWith('/stories/')) return { subtype: 'story', title: 'Instagram Story' };
      return { subtype: 'profile', title: 'Instagram Profile' };
    },
  },
  {
    hostname: /^(www\.)?youtube\.com$/,
    platform: 'youtube',
    detect(url) {
      const p = url.pathname;
      if (p === '/watch') return { subtype: 'video', title: 'YouTube Video' };
      if (p.startsWith('/shorts/')) return { subtype: 'shorts', title: 'YouTube Short' };
      if (p.startsWith('/playlist')) return { subtype: 'playlist', title: 'YouTube Playlist' };
      if (p.startsWith('/channel/') || p.startsWith('/@')) return { subtype: 'channel', title: 'YouTube Channel' };
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
    hostname: /^(www\.)?(twitter|x)\.com$/,
    platform: 'twitter',
    detect(url) {
      if (url.pathname.includes('/status/')) return { subtype: 'tweet', title: 'Tweet' };
      return { subtype: 'profile', title: 'Twitter Profile' };
    },
  },
  {
    hostname: /^(www\.)?tiktok\.com$/,
    platform: 'tiktok',
    detect(url) {
      if (/\/@[^/]+\/video\//.test(url.pathname)) return { subtype: 'video', title: 'TikTok Video' };
      return { subtype: 'profile', title: 'TikTok Profile' };
    },
  },
  {
    hostname: /^(www\.)?reddit\.com$/,
    platform: 'reddit',
    detect(url) {
      const p = url.pathname;
      if (p.startsWith('/r/') && p.includes('/comments/')) return { subtype: 'post', title: 'Reddit Post' };
      if (p.startsWith('/r/')) return { subtype: 'community', title: 'Reddit Community' };
      return { subtype: 'post', title: 'Reddit' };
    },
  },
  {
    hostname: /^(www\.)?github\.com$/,
    platform: 'github',
    detect(url) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) return { subtype: 'repo', title: 'GitHub Repository' };
      return { subtype: 'profile', title: 'GitHub Profile' };
    },
  },
  {
    hostname: /^(www\.)?medium\.com$/,
    platform: 'medium',
    detect() {
      return { subtype: 'article', title: 'Medium Article' };
    },
  },
];

export function detectContent(content: string): DetectionResult {
  const trimmed = content.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    const title = trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
    return { type: 'note', platform: null, subtype: null, tags: [], title };
  }

  for (const rule of PLATFORM_RULES) {
    if (rule.hostname.test(url.hostname)) {
      const { subtype, title } = rule.detect(url);
      return {
        type: 'url',
        platform: rule.platform,
        subtype,
        tags: [rule.platform, subtype],
        title,
      };
    }
  }

  const hostname = url.hostname.replace(/^www\./, '');
  return {
    type: 'url',
    platform: null,
    subtype: null,
    tags: [hostname.split('.')[0]],
    title: hostname,
  };
}
