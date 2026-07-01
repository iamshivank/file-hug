'use client';

import { useEffect, useRef, useState } from 'react';
import { X, FileText, ExternalLink, Pencil, Check, Loader2 } from 'lucide-react';
import { MemoryData, UpdateMemoryInput } from '../types/memory.types';
import PlatformIcon from './PlatformIcon';
import ConnectLinksField from './ConnectLinksField';
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

  const handleSave = async () => {
    if (!body.trim() || saving) return;
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
        className="flip-card w-full max-w-lg max-h-[85vh] flex flex-col glass-strong rounded-2xl border border-border-strong shadow-2xl shadow-black/60 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 border-b border-border shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-border flex items-center justify-center shrink-0 text-primary-light">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
            {editing ? 'Edit note' : memory.title}
          </span>
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
        <div className="overflow-y-auto px-6 py-5">
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
                  placeholder="Title (optional)"
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-xl bg-background border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wider text-muted font-medium mb-1.5">
                  Note
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
                <ConnectLinksField
                  savedLinks={savedLinks}
                  selectedIds={linkedIds}
                  onToggle={toggleLinked}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap break-words">
                {memory.content}
              </p>

              {memory.tags.filter((t) => t !== 'note').length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-5">
                  {memory.tags
                    .filter((t) => t !== 'note')
                    .map((tag) => (
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
                  <p className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2.5">
                    Linked sources
                  </p>
                  <div className="flex flex-col gap-1">
                    {connectedLinks.map((link) => (
                      <button
                        key={link.id}
                        type="button"
                        onClick={() => onOpenLink(link)}
                        className="group flex items-center gap-2.5 px-2.5 py-2 -mx-2.5 rounded-lg text-left hover:bg-surface-hover transition-colors cursor-pointer min-w-0"
                      >
                        <PlatformIcon
                          platform={link.tags.length > 0 ? link.tags[0] : null}
                          type="url"
                          className="w-4 h-4 shrink-0 text-primary-light"
                        />
                        <span className="flex-1 min-w-0 truncate text-sm text-foreground group-hover:text-primary-light transition-colors">
                          {link.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
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
              disabled={saving || !body.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary-light text-background text-sm font-semibold rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
