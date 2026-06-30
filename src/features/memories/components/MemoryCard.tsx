'use client';

import { Clock } from 'lucide-react';
import { MemoryData } from '../types/memory.types';
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
  /** Opens the PiP preview — only passed for URL cards. */
  onOpen?: () => void;
  /** Resolved link memories this note is connected to. */
  connectedLinks?: MemoryData[];
  /** Opens the PiP preview for a connected link. */
  onOpenConnected?: (link: MemoryData) => void;
}

export default function MemoryCard({
  memory,
  onOpen,
  connectedLinks = [],
  onOpenConnected,
}: MemoryCardProps) {
  const isUrl = memory.type === 'url';
  const platform = isUrl && memory.tags.length > 0 ? memory.tags[0] : null;
  const badgeText = platform ?? 'note';

  // For URL cards the first two tags are platform/subtype (shown elsewhere);
  // for notes, drop the implicit "note" tag from the chip row.
  const extraTags = (isUrl ? memory.tags.slice(2) : memory.tags.filter((t) => t !== 'note')).slice(0, 3);

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={`card p-5 hover:border-border-strong hover:bg-surface-hover transition-all duration-300 hover:-translate-y-0.5 group flex flex-col gap-3 ${
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
        <div className="flex items-center gap-1 text-muted text-xs shrink-0">
          <Clock className="w-3 h-3" />
          <span>{timeAgo(memory.createdAt)}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="font-display text-base text-foreground leading-snug group-hover:text-primary-light transition-colors line-clamp-2">
        {memory.title}
      </h3>

      {/* Content preview */}
      <p className={`text-muted text-xs leading-relaxed flex-1 ${isUrl ? 'truncate' : 'line-clamp-3'}`}>
        {memory.content}
      </p>

      {/* Connected links — saved URLs this note points to */}
      {connectedLinks.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-border">
          {connectedLinks.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenConnected?.(link);
              }}
              className="inline-flex items-center gap-2 px-2 py-1.5 -mx-1 rounded-lg text-left text-xs text-primary-light hover:bg-surface-hover transition-colors cursor-pointer min-w-0"
            >
              <PlatformIcon
                platform={link.tags.length > 0 ? link.tags[0] : null}
                type="url"
                className="w-3.5 h-3.5 shrink-0"
              />
              <span className="truncate">{link.title}</span>
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
