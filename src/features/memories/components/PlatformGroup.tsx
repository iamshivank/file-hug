'use client';

import { useState } from 'react';
import { MemoryData } from '../types/memory.types';
import { filterMemories } from '../utils/search';
import MemoryCard from './MemoryCard';
import PlatformIcon from './PlatformIcon';
import SearchBar from './SearchBar';

interface PlatformGroupProps {
  /** Group key: a platform word, 'other', or 'note' for the Notes group. */
  platform: string;
  /** Human-friendly heading. */
  label: string;
  /** Memories in this group (already narrowed by the global search). */
  memories: MemoryData[];
  /** Opens a card's preview, anchored to its on-screen rect. */
  onOpen: (memory: MemoryData, rect: DOMRect) => void;
  /** Opens a note straight into edit mode (notes only). */
  onEdit: (memory: MemoryData) => void;
  /** Resolves the link memories a note points to. */
  connectedLinksFor: (memory: MemoryData) => MemoryData[];
  /** Opens a connected link's preview from a card. */
  onOpenConnected: (link: MemoryData, rect: DOMRect) => void;
}

/**
 * One platform section in the grouped view: a header (icon + label + count
 * chip), its own search field that narrows *only within this group*, and the
 * standard responsive grid of cards.
 */
export default function PlatformGroup({
  platform,
  label,
  memories,
  onOpen,
  onEdit,
  connectedLinksFor,
  onOpenConnected,
}: PlatformGroupProps) {
  const [query, setQuery] = useState('');
  const isNotes = platform === 'note';

  const visible = filterMemories(memories, query);

  return (
    <section className="mb-8 last:mb-0">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-border flex items-center justify-center shrink-0 text-primary-light">
            <PlatformIcon
              platform={isNotes ? null : platform === 'other' ? null : platform}
              type={isNotes ? 'note' : 'url'}
              className="w-4 h-4"
            />
          </div>
          <h3 className="font-display text-lg text-foreground truncate">{label}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted tabular-nums shrink-0">
            {memories.length}
          </span>
        </div>

        <SearchBar
          value={query}
          onChange={setQuery}
          size="compact"
          placeholder={`Search ${label}…`}
          ariaLabel={`Search within ${label}`}
          className="w-full sm:w-56"
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-muted text-sm text-center py-10 card">
          No results for &ldquo;{query}&rdquo; in {label}.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onOpen={(rect) => onOpen(memory, rect)}
              onEdit={isNotes ? () => onEdit(memory) : undefined}
              connectedLinks={isNotes ? connectedLinksFor(memory) : undefined}
              onOpenConnected={onOpenConnected}
            />
          ))}
        </div>
      )}
    </section>
  );
}
