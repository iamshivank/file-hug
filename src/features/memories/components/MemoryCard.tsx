'use client';

import { Clock, Pencil, FileText, Loader2, Captions, AlertCircle } from 'lucide-react';
import { MemoryData } from '../types/memory.types';
import { enrichmentState } from '../utils/enrichment';
import PlatformIcon from './PlatformIcon';

function timeAgo(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface MemoryCardProps {
  memory: MemoryData;
  /** Used only to stagger the visual entrance of a grid. */
  index?: number;
  /** Opens the preview/popup for this card, anchored to its on-screen rect. */
  onOpen?: (rect: DOMRect) => void;
  /** Opens this card straight into edit mode — only passed for notes. */
  onEdit?: () => void;
  /** Memories connected to this one (links for a note, notes for a link). */
  connected?: MemoryData[];
  /** Opens the connected memory's preview, anchored to the clicked row. */
  onOpenConnected?: (item: MemoryData, rect: DOMRect) => void;
}

export default function MemoryCard({
  memory,
  index = 0,
  onOpen,
  onEdit,
  connected = [],
  onOpenConnected,
}: MemoryCardProps) {
  const isUrl = memory.type === 'url';
  const platform = isUrl && memory.tags.length > 0 ? memory.tags[0] : null;
  const badgeText = platform ?? 'note';

  // For URL cards the first two tags are platform/subtype (shown elsewhere);
  // for notes, drop the implicit "note" tag from the chip row.
  const extraTags = (isUrl ? memory.tags.slice(2) : memory.tags.filter((t) => t !== 'note')).slice(0, 3);

  const enrichment = memory.enrichment;
  const state = enrichmentState(enrichment);
  const isIndexing = state === 'indexing';
  // A stalled read is presented as a failure — from the user's side it is one.
  const indexFailed = state === 'failed' || state === 'stalled';

  // The most informative line available: what the page says about itself, then
  // its own title, and only the bare URL as a last resort.
  const summary = enrichment?.description || enrichment?.pageTitle || memory.content;
  // A real page title earns its own line under the platform label.
  const pageTitle =
    enrichment?.pageTitle && enrichment.pageTitle !== memory.title ? enrichment.pageTitle : null;

  // The card's on-screen rect is the flip origin for the popup — capture it
  // from the element itself so click and keyboard opens both anchor correctly.
  const handleOpen = (el: HTMLElement) => {
    onOpen?.(el.getBoundingClientRect());
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    card.style.setProperty('--card-rotate-x', `${(0.5 - y) * 5}deg`);
    card.style.setProperty('--card-rotate-y', `${(x - 0.5) * 5}deg`);
    card.style.setProperty('--card-glow-x', `${x * 100}%`);
    card.style.setProperty('--card-glow-y', `${y * 100}%`);
  };

  const resetTilt = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty('--card-rotate-x');
    event.currentTarget.style.removeProperty('--card-rotate-y');
  };

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={(e) => handleOpen(e.currentTarget)}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpen(e.currentTarget);
              }
            }
          : undefined
      }
      data-memory-type={memory.type}
      style={{ '--card-index': index } as React.CSSProperties}
      className={`card memory-card p-5 group flex flex-col gap-3 ${
        onOpen ? 'cursor-pointer' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-border flex items-center justify-center shrink-0 text-primary-light">
            <PlatformIcon platform={platform} type={memory.type} className="w-4 h-4" />
          </div>
          <span className="text-[11px] uppercase tracking-wider text-muted font-medium">
            {badgeText}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 text-muted text-xs">
            <Clock className="w-3 h-3" />
            <span>{timeAgo(memory.createdAt)}</span>
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label="Edit note"
              className="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-muted hover:text-primary-light hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-display text-base text-foreground leading-snug group-hover:text-primary-light transition-colors line-clamp-2">
        {pageTitle ?? memory.title}
      </h3>

      {/* Content preview — the page's own words when we have them, else the URL */}
      <p
        className={`text-muted text-xs leading-relaxed flex-1 ${
          isUrl && summary === memory.content ? 'truncate' : 'line-clamp-3'
        }`}
      >
        {summary}
      </p>

      {/* What the indexer is doing, or what it found */}
      {isUrl && (isIndexing || indexFailed || enrichment?.hasTranscript) && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          {isIndexing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-primary-light shrink-0" />
              <span>Reading this link…</span>
            </>
          ) : indexFailed ? (
            <>
              <AlertCircle className="w-3 h-3 text-danger shrink-0" />
              <span className="truncate">Couldn&apos;t read this link</span>
            </>
          ) : (
            <>
              <Captions className="w-3 h-3 text-primary-light shrink-0" />
              <span>Transcript searchable</span>
            </>
          )}
        </div>
      )}

      {/* Connected memories — links this note points to, or notes on this link */}
      {connected.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
          {connected.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenConnected?.(item, e.currentTarget.getBoundingClientRect());
              }}
              className="inline-flex items-center gap-2 px-2 py-1.5 -mx-1 rounded-lg text-left text-xs text-primary-light hover:bg-surface-hover transition-colors cursor-pointer min-w-0"
            >
              {item.type === 'note' ? (
                <FileText className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <PlatformIcon
                  platform={item.tags.length > 0 ? item.tags[0] : null}
                  type="url"
                  className="w-3.5 h-3.5 shrink-0"
                />
              )}
              <span className="truncate">{item.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tags */}
      {extraTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {extraTags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 bg-background border border-border rounded-full text-muted"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
