'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Loader2, Globe, FileText, Check, Plus } from 'lucide-react';
import { MemoryData, UpdateMemoryInput } from '../types/memory.types';
import { getEmbedInfo } from '../utils/embed';
import { detectContent } from '../utils/urlDetection';
import { playFlipOpen } from '../utils/flip';
import PlatformIcon from './PlatformIcon';
import ConnectMemoriesField from './ConnectMemoriesField';

interface LinkPreviewProps {
  memory: MemoryData;
  /** Notes connected to this link (the reverse side of a note→link link). */
  connectedNotes: MemoryData[];
  /** All saved notes the user can connect this link to. */
  savedNotes: MemoryData[];
  /** On-screen rect of the clicked card — the flip origin for the PiP. */
  originRect?: DOMRect | null;
  onClose: () => void;
  /** Opens the note modal for a connected note. */
  onOpenNote: (note: MemoryData) => void;
  /** Persists connection changes; resolves true on success. */
  onSave: (input: UpdateMemoryInput) => Promise<boolean>;
}

/** Floating picture-in-picture viewer for a saved link's content and its notes. */
export default function LinkPreview({
  memory,
  connectedNotes,
  savedNotes,
  originRect,
  onClose,
  onOpenNote,
  onSave,
}: LinkPreviewProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Tracking the loaded memory id (rather than a boolean) makes the spinner
  // reappear automatically when the user switches to another card.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const isLoaded = loadedId === memory.id;

  // Connect-notes editing state (the reverse side of the linking feature).
  const [editing, setEditing] = useState(false);
  const [linkedIds, setLinkedIds] = useState<string[]>(memory.linkedMemoryIds ?? []);
  const [saving, setSaving] = useState(false);

  const embed = getEmbedInfo(memory.content);
  const detection = detectContent(memory.content);

  // On mount, flip the PiP open from the clicked card toward its resting corner.
  useEffect(() => {
    if (cardRef.current) {
      playFlipOpen(cardRef.current, originRect, { transformOrigin: 'top left' });
    }
    // Only run once on open — `originRect` is captured at click time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const toggleLinked = (id: string) => {
    setLinkedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const startEdit = () => {
    setLinkedIds(memory.linkedMemoryIds ?? []);
    setEditing(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onSave({ id: memory.id, linkedMemoryIds: linkedIds });
    setSaving(false);
    if (ok) setEditing(false);
  };

  const sizeClass =
    embed?.aspect === 'vertical'
      ? 'w-[300px] sm:w-[320px]'
      : embed?.aspect === 'wide'
        ? 'w-[min(calc(100vw-2rem),420px)]'
        : 'w-[min(calc(100vw-2rem),380px)]';

  const frameClass =
    embed?.aspect === 'vertical'
      ? 'h-[440px]'
      : embed?.aspect === 'wide'
        ? 'aspect-video'
        : 'h-[380px]';

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
      className={`fixed bottom-4 right-4 z-50 ${sizeClass} flip-stage`}
    >
      <div
        ref={cardRef}
        className="flip-card-pip glass-strong rounded-2xl border border-border-strong shadow-2xl shadow-black/60 overflow-hidden flex flex-col max-h-[86vh]"
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 border-b border-border shrink-0">
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

        {/* Body — embed or fallback */}
        {embed ? (
          <div className={`relative bg-background shrink-0 ${frameClass}`}>
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
          <div className="px-6 py-8 text-center shrink-0">
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
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-on-accent text-sm font-semibold rounded-full transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open link
            </a>
          </div>
        )}

        {/* Linked notes — the reverse side of connecting notes to links */}
        <div className="border-t border-border overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-1">
            <span className="text-[11px] uppercase tracking-wider text-muted font-medium">
              Linked notes
            </span>
            {!editing && (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary-light transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Link a note
              </button>
            )}
          </div>

          {editing ? (
            <div className="px-3.5 pb-3">
              <ConnectMemoriesField
                candidates={savedNotes}
                selectedIds={linkedIds}
                onToggle={toggleLinked}
                noun="note"
              />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary hover:bg-primary-light text-on-accent text-xs font-semibold rounded-full transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </button>
              </div>
            </div>
          ) : connectedNotes.length > 0 ? (
            <div className="px-2 pb-2">
              {connectedNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onOpenNote(note)}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-surface-hover transition-colors cursor-pointer min-w-0"
                >
                  <span className="text-primary-light shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm text-foreground">{note.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted px-3.5 pb-3 leading-relaxed">
              No notes linked yet. Connect a note to keep your thoughts with this source.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
