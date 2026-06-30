'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2, Globe } from 'lucide-react';
import { MemoryData } from '../types/memory.types';
import { getEmbedInfo } from '../utils/embed';
import { detectContent } from '../utils/urlDetection';
import PlatformIcon from './PlatformIcon';

interface LinkPreviewProps {
  memory: MemoryData;
  onClose: () => void;
}

/** Floating picture-in-picture viewer for a saved link's content. */
export default function LinkPreview({ memory, onClose }: LinkPreviewProps) {
  // Tracking the loaded memory id (rather than a boolean) makes the spinner
  // reappear automatically when the user switches to another card.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const isLoaded = loadedId === memory.id;

  const embed = getEmbedInfo(memory.content);
  const detection = detectContent(memory.content);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const sizeClass =
    embed?.aspect === 'vertical'
      ? 'w-[300px] sm:w-[320px]'
      : embed?.aspect === 'wide'
        ? 'w-[min(calc(100vw-2rem),420px)]'
        : 'w-[min(calc(100vw-2rem),380px)]';

  const frameClass =
    embed?.aspect === 'vertical'
      ? 'h-[500px]'
      : embed?.aspect === 'wide'
        ? 'aspect-video'
        : 'h-[440px]';

  let hostname = '';
  try {
    hostname = new URL(memory.content).hostname.replace(/^www\./, '');
  } catch {
    /* not a parseable URL — fallback panel still renders */
  }

  return (
    <div
      role="dialog"
      aria-label={`Preview of ${memory.title}`}
      className={`fixed bottom-4 right-4 z-50 ${sizeClass} animate-slide-up`}
    >
      <div className="glass-strong rounded-2xl border border-border-strong shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 border-b border-border">
          <div className="text-primary-light shrink-0">
            <PlatformIcon platform={detection.platform} type="url" className="w-4 h-4" />
          </div>
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
            {memory.title}
          </span>
          <a
            href={memory.content}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open original"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {embed ? (
          <div className={`relative bg-background ${frameClass}`}>
            {!isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
            <iframe
              key={memory.id}
              src={embed.src}
              title={memory.title}
              onLoad={() => setLoadedId(memory.id)}
              allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className={`w-full h-full border-0 transition-opacity duration-300 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-border flex items-center justify-center mx-auto mb-4">
              {hostname ? (
                /* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon, not worth next/image */
                <img
                  src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`}
                  alt=""
                  className="w-6 h-6 rounded"
                />
              ) : (
                <Globe className="w-5 h-5 text-primary-light" />
              )}
            </div>
            <p className="text-sm text-muted-light mb-1">{hostname || 'This link'}</p>
            <p className="text-xs text-muted mb-5 leading-relaxed">
              This site doesn&apos;t allow inline previews.
            </p>
            <a
              href={memory.content}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-background text-sm font-semibold rounded-full transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open link
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
