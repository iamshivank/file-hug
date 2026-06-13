export interface EmbedInfo {
  /** iframe src that renders the content natively (platform embed endpoint). */
  src: string;
  /** Shape of the PiP window: vertical (reels/shorts), wide (16:9 video), social (posts/threads). */
  aspect: 'vertical' | 'wide' | 'social';
}

/**
 * Maps a saved URL to a platform embed the browser can render in an iframe.
 * Returns null when the platform has no embed endpoint (or blocks framing) —
 * the viewer falls back to an "open original" panel.
 */
export function getEmbedInfo(content: string): EmbedInfo | null {
  let url: URL;
  try {
    url = new URL(content.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'instagram.com') {
    // /reel/{code}, /reels/{code}, /p/{code}, /tv/{code} — embed lives at /{kind}/{code}/embed/
    const kind = parts[0] === 'reels' ? 'reel' : parts[0];
    if (['reel', 'p', 'tv'].includes(kind) && parts[1]) {
      return {
        src: `https://www.instagram.com/${kind}/${parts[1]}/embed/`,
        aspect: kind === 'p' ? 'social' : 'vertical',
      };
    }
    return null;
  }

  if (host === 'youtube.com') {
    const videoId = url.searchParams.get('v');
    if (url.pathname === '/watch' && videoId) {
      return { src: `https://www.youtube-nocookie.com/embed/${videoId}`, aspect: 'wide' };
    }
    if (parts[0] === 'shorts' && parts[1]) {
      return { src: `https://www.youtube-nocookie.com/embed/${parts[1]}`, aspect: 'vertical' };
    }
    const listId = url.searchParams.get('list');
    if (parts[0] === 'playlist' && listId) {
      return {
        src: `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}`,
        aspect: 'wide',
      };
    }
    return null;
  }

  if (host === 'youtu.be' && parts[0]) {
    return { src: `https://www.youtube-nocookie.com/embed/${parts[0]}`, aspect: 'wide' };
  }

  if (host === 'twitter.com' || host === 'x.com') {
    const statusIdx = parts.indexOf('status');
    const tweetId = statusIdx !== -1 ? parts[statusIdx + 1] : undefined;
    if (tweetId) {
      return {
        src: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark&dnt=true`,
        aspect: 'social',
      };
    }
    return null;
  }

  if (host === 'tiktok.com') {
    const videoIdx = parts.indexOf('video');
    const videoId = videoIdx !== -1 ? parts[videoIdx + 1] : undefined;
    if (videoId) {
      return { src: `https://www.tiktok.com/embed/v2/${videoId}`, aspect: 'vertical' };
    }
    return null;
  }

  if (host === 'reddit.com' && parts[0] === 'r' && parts.includes('comments')) {
    return {
      src: `https://embed.reddit.com${url.pathname}?embed=true&theme=dark`,
      aspect: 'social',
    };
  }

  // GitHub, Medium and most other sites send X-Frame-Options: DENY — no embed.
  return null;
}
