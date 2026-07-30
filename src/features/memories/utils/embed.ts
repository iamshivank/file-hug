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

  const host = url.hostname.replace(/^(www\.|m\.|mobile\.)+/, '');
  const parts = url.pathname.split('/').filter(Boolean);

  if (host === 'instagram.com') {
    // Reels/posts appear as `/{kind}/{code}` and also as `/{username}/{kind}/{code}`,
    // with `reels` as an alias for `reel`. Find the kind wherever it sits so the
    // profile-prefixed form embeds too; the embed always lives at /{kind}/{code}/embed/.
    const kindIndex = parts.findIndex((part) => ['reel', 'reels', 'p', 'tv'].includes(part));
    const code = kindIndex === -1 ? undefined : parts[kindIndex + 1];
    if (kindIndex !== -1 && code) {
      const kind = parts[kindIndex] === 'reels' ? 'reel' : parts[kindIndex];
      return {
        src: `https://www.instagram.com/${kind}/${code}/embed/`,
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

  if (host === 'open.spotify.com') {
    // /intl-xx/ locale prefixes sit before the resource kind.
    const offset = parts[0]?.startsWith('intl-') ? 1 : 0;
    const kind = parts[offset];
    const id = parts[offset + 1];
    if (id && ['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(kind)) {
      return { src: `https://open.spotify.com/embed/${kind}/${id}`, aspect: 'social' };
    }
    return null;
  }

  if (host === 'vimeo.com') {
    const id = parts.find((part) => /^\d+$/.test(part));
    if (id) return { src: `https://player.vimeo.com/video/${id}`, aspect: 'wide' };
    return null;
  }

  if (host === 'twitch.tv' || host === 'clips.twitch.tv') {
    // Twitch requires the embedding page's hostname in `parent`. Only the browser
    // knows it, so read it at call time and skip the embed during SSR.
    const parent = typeof window === 'undefined' ? null : window.location.hostname;
    if (!parent) return null;
    if (host === 'clips.twitch.tv' && parts[0]) {
      return {
        src: `https://clips.twitch.tv/embed?clip=${parts[0]}&parent=${parent}`,
        aspect: 'wide',
      };
    }
    if (parts[0] === 'videos' && parts[1]) {
      return {
        src: `https://player.twitch.tv/?video=${parts[1]}&parent=${parent}&autoplay=false`,
        aspect: 'wide',
      };
    }
    if (parts[0]) {
      return {
        src: `https://player.twitch.tv/?channel=${parts[0]}&parent=${parent}&autoplay=false`,
        aspect: 'wide',
      };
    }
    return null;
  }

  // GitHub, Medium, LinkedIn and most other sites send X-Frame-Options: DENY —
  // no embed, so the viewer falls back to its metadata panel.
  return null;
}
