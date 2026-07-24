'use client';

import { useState } from 'react';
import { Link2, ChevronDown, Check, X } from 'lucide-react';
import { MemoryData } from '../types/memory.types';
import PlatformIcon from './PlatformIcon';

interface ConnectMemoriesFieldProps {
  /** All memories the user can connect to (links when editing a note, notes when editing a link). */
  candidates: MemoryData[];
  /** Currently connected memory ids. */
  selectedIds: string[];
  /** Toggle a memory id on/off. */
  onToggle: (id: string) => void;
  /** Noun used in labels — e.g. 'link' or 'note'. */
  noun?: string;
}

/** Icon for a candidate, inferred from whether it's a link or a note. */
function candidateIcon(memory: MemoryData, className: string) {
  return (
    <PlatformIcon
      platform={memory.type === 'url' && memory.tags.length > 0 ? memory.tags[0] : null}
      type={memory.type}
      className={className}
    />
  );
}

/**
 * Self-contained "connect saved memories" control: shows connected items as
 * removable chips, a toggle to open the picker, and the picker list itself.
 * Generic over what it connects to — notes connect to links, links to notes —
 * so the composer, note editor and link editor all share one control.
 */
export default function ConnectMemoriesField({
  candidates,
  selectedIds,
  onToggle,
  noun = 'link',
}: ConnectMemoriesFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* Connected items — chips for what's attached so far */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedIds.map((id) => {
            const item = candidates.find((c) => c.id === id);
            if (!item) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 max-w-full pl-2.5 pr-1 py-1 rounded-full bg-primary/10 border border-border text-xs text-primary-light"
              >
                {candidateIcon(item, 'w-3 h-3 shrink-0')}
                <span className="truncate max-w-[180px]">{item.title}</span>
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  aria-label={`Remove ${noun} ${item.title}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-muted hover:text-foreground transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 -mx-1 rounded-full text-xs text-muted hover:text-primary-light hover:bg-surface-hover transition-colors cursor-pointer"
      >
        <Link2 className="w-3.5 h-3.5" />
        {selectedIds.length > 0 ? `Add more ${noun}s` : `Connect a saved ${noun}`}
        {selectedIds.length > 0 && (
          <span className="tabular-nums text-primary-light">({selectedIds.length})</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Picker — connect to memories already in the library */}
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-background/60 max-h-56 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-xs text-muted px-4 py-5 text-center leading-relaxed">
              No saved {noun}s yet — save a {noun} first, then you can connect it here.
            </p>
          ) : (
            candidates.map((item) => {
              const selected = selectedIds.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onToggle(item.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <span className="text-primary-light shrink-0">{candidateIcon(item, 'w-4 h-4')}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-foreground truncate">{item.title}</span>
                    <span className="block text-[11px] text-muted truncate">{item.content}</span>
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      selected
                        ? 'bg-primary border-primary text-on-accent'
                        : 'border-border text-transparent'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
