'use client';

import { useState } from 'react';
import { Link2, ChevronDown, Check, X } from 'lucide-react';
import { MemoryData } from '../types/memory.types';
import PlatformIcon from './PlatformIcon';

interface ConnectLinksFieldProps {
  /** All saved link memories the user can connect to. */
  savedLinks: MemoryData[];
  /** Currently connected link ids. */
  selectedIds: string[];
  /** Toggle a link id on/off. */
  onToggle: (id: string) => void;
}

/**
 * Self-contained "connect saved links" control: shows connected links as
 * removable chips, a toggle to open the picker, and the picker list itself.
 * Shared by the create composer and the note editor so both stay in sync.
 */
export default function ConnectLinksField({ savedLinks, selectedIds, onToggle }: ConnectLinksFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* Connected links — chips for what's attached so far */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedIds.map((id) => {
            const link = savedLinks.find((l) => l.id === id);
            if (!link) return null;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 max-w-full pl-2.5 pr-1 py-1 rounded-full bg-primary/10 border border-border text-xs text-primary-light"
              >
                <PlatformIcon platform={link.tags[0] ?? null} type="url" className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[180px]">{link.title}</span>
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  aria-label={`Remove link ${link.title}`}
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
        {selectedIds.length > 0 ? 'Add more links' : 'Connect a saved link'}
        {selectedIds.length > 0 && (
          <span className="tabular-nums text-primary-light">({selectedIds.length})</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Picker — connect to links already in the library */}
      {open && (
        <div className="mt-2 rounded-xl border border-border bg-background/60 max-h-56 overflow-y-auto">
          {savedLinks.length === 0 ? (
            <p className="text-xs text-muted px-4 py-5 text-center leading-relaxed">
              No saved links yet — save a link first, then you can connect notes to it.
            </p>
          ) : (
            savedLinks.map((link) => {
              const selected = selectedIds.includes(link.id);
              return (
                <button
                  type="button"
                  key={link.id}
                  onClick={() => onToggle(link.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <span className="text-primary-light shrink-0">
                    <PlatformIcon platform={link.tags[0] ?? null} type="url" className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-foreground truncate">{link.title}</span>
                    <span className="block text-[11px] text-muted truncate">{link.content}</span>
                  </span>
                  <span
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                      selected
                        ? 'bg-primary border-primary text-background'
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
