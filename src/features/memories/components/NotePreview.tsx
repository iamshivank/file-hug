'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  FileText,
  ExternalLink,
  Pencil,
  Check,
  Loader2,
  CalendarDays,
  Link2,
  Type,
} from 'lucide-react';
import { MemoryData, UpdateMemoryInput } from '../types/memory.types';
import PlatformIcon from './PlatformIcon';
import ConnectMemoriesField from './ConnectMemoriesField';
import { playFlipOpen } from '../utils/flip';

interface NotePreviewProps {
  memory: MemoryData;
  /** Resolved link memories this note is connected to. */
  connectedLinks: MemoryData[];
  /** All saved link memories the user can connect while editing. */
  savedLinks: MemoryData[];
  /** Open straight into edit mode (e.g. from a card's edit button). */
  startInEdit?: boolean;
  /** On-screen rect of the clicked card — the flip origin for the popup. */
  originRect?: DOMRect | null;
  onClose: () => void;
  /** Opens the link preview for a connected link (closes this modal first). */
  onOpenLink: (link: MemoryData) => void;
  /** Persists an edit; resolves true on success. */
  onSave: (input: UpdateMemoryInput) => Promise<boolean>;
}

function formatDate(input: string | Date): string {
  return new Date(input).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Centered modal for viewing and editing a saved note plus its linked sources. */
export default function NotePreview({
  memory,
  connectedLinks,
  savedLinks,
  startInEdit = false,
  originRect,
  onClose,
  onOpenLink,
  onSave,
}: NotePreviewProps) {
  const [editing, setEditing] = useState(startInEdit);
  const [title, setTitle] = useState(memory.title);
  const [body, setBody] = useState(memory.content);
  const [linkedIds, setLinkedIds] = useState<string[]>(memory.linkedMemoryIds ?? []);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // On mount, flip the modal open from the clicked card's position.
  useEffect(() => {
    if (cardRef.current) {
      playFlipOpen(cardRef.current, originRect, { transformOrigin: 'center top' });
    }
    // Only run once on open — `originRect` is captured at click time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const startEdit = () => {
    setTitle(memory.title);
    setBody(memory.content);
    setLinkedIds(memory.linkedMemoryIds ?? []);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (startInEdit) {
      onClose();
      return;
    }
    setEditing(false);
  };

  const toggleLinked = (id: string) => {
    setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // A note is saveable with just a title, just a body, or both.
  const canSave = !!(title.trim() || body.trim());

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const ok = await onSave({
      id: memory.id,
      title: title.trim(),
      content: body.trim(),
      linkedMemoryIds: linkedIds,
    });
    setSaving(false);
    if (ok) setEditing(false);
  };

  const tags = memory.tags.filter((t) => t !== 'note');
  const wordCount = memory.content.trim() ? memory.content.trim().split(/\s+/).length : 0;
  const hasBody = memory.content.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in flip-stage"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? `Editing note: ${memory.title}` : `Note: ${memory.title}`}
        onClick={(e) => e.stopPropagation()}
        className="flip-card note-sheet w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-border-strong shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* Signature gradient hairline across the top */}
        <div className="note-sheet-accent" aria-hidden />

        {/* Header */}
        <div className="flex items-center gap-3 pl-4 pr-2 py-3 border-b border-border shrink-0">
          <div className="note-glyph shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="truncate font-display text-lg leading-tight text-foreground">
              {editing ? 'Edit note' : memory.title}
            </h2>
            {!editing && (
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Note</span>
            )}
          </div>
          {!editing && (
            <button
              type="button"
              onClick={startEdit}
              aria-label="Edit note"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-muted hover:text-primary-light hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close note"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give it a title…"
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1.5">
                  Note <span className="normal-case tracking-normal text-muted/70">(optional)</span>
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  maxLength={5000}
                  placeholder="Write a thought you want to remember…"
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all resize-none leading-relaxed"
                />
                <span className="block text-right text-xs text-muted tabular-nums mt-1">
                  {body.length}/5000
                </span>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
                  Linked sources
                </label>
                <ConnectMemoriesField
                  candidates={savedLinks}
                  selectedIds={linkedIds}
                  onToggle={toggleLinked}
                  noun="link"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Meta strip — gives the sheet an editorial, "at a glance" feel */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted mb-5">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {formatDate(memory.createdAt)}
                </span>
                {hasBody && (
                  <span className="inline-flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5" />
                    {wordCount} {wordCount === 1 ? 'word' : 'words'}
                  </span>
                )}
                {connectedLinks.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-primary-light">
                    <Link2 className="w-3.5 h-3.5" />
                    {connectedLinks.length} linked
                  </span>
                )}
              </div>

              {hasBody ? (
                <p
                  className={`note-prose text-foreground leading-relaxed whitespace-pre-wrap break-words ${
                    memory.content.trim().length > 90 ? 'has-dropcap' : ''
                  }`}
                >
                  {memory.content}
                </p>
              ) : (
                <p className="text-muted italic text-sm">
                  No note text — just a title{connectedLinks.length > 0 ? ' and linked sources.' : '.'}
                </p>
              )}

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 bg-background border border-border rounded-full text-muted"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {connectedLinks.length > 0 && (
                <div className="mt-6 pt-5 border-t border-border">
                  <p className="text-[11px] uppercase tracking-wider text-muted font-medium mb-3">
                    Linked sources
                  </p>
                  <div className="grid gap-2">
                    {connectedLinks.map((link) => {
                      const host = hostOf(link.content);
                      return (
                        <button
                          key={link.id}
                          type="button"
                          onClick={() => onOpenLink(link)}
                          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-background/50 text-left hover:border-border-strong hover:bg-surface-hover transition-colors cursor-pointer min-w-0"
                        >
                          <span className="w-8 h-8 rounded-lg bg-primary/10 border border-border flex items-center justify-center shrink-0 text-primary-light">
                            <PlatformIcon
                              platform={link.tags.length > 0 ? link.tags[0] : null}
                              type="url"
                              className="w-4 h-4"
                            />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block truncate text-sm text-foreground group-hover:text-primary-light transition-colors">
                              {link.title}
                            </span>
                            {host && <span className="block truncate text-[11px] text-muted">{host}</span>}
                          </span>
                          <ExternalLink className="w-4 h-4 shrink-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Edit actions */}
        {editing && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="px-4 py-2 rounded-full text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canSave}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-light text-on-accent text-sm font-semibold rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
