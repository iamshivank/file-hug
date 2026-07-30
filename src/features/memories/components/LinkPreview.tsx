'use client';

import { useEffect, useRef, useState } from 'react';
import {
  X,
  ExternalLink,
  Loader2,
  Globe,
  FileText,
  Check,
  Plus,
  RefreshCw,
  Captions,
  AlertCircle,
} from 'lucide-react';
import { MemoryData, UpdateMemoryInput } from '../types/memory.types';
import { getEmbedInfo } from '../utils/embed';
import { enrichmentState } from '../utils/enrichment';
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
  /** Re-opens the link and rebuilds its search index. Omitted in demo mode. */
  onReindex?: (id: string) => Promise<boolean>;
  /** True while this link is being re-read. */
  isReindexing?: boolean;
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
  onReindex,
  isReindexing = false,
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

  const enrichment = memory.enrichment;
  const state = enrichmentState(enrichment);
  const isIndexing = state === 'indexing' || isReindexing;
  // Treat a stalled read as failed — the retry below is the way out of both.
  const indexFailed = (state === 'failed' || state === 'stalled') && !isReindexing;

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
            {enrichment?.pageTitle || memory.title}
          </span>
          {onReindex && (
            <button
              type="button"
              onClick={() => onReindex(memory.id)}
              disabled={isIndexing}
              aria-label="Re-read this link"
              title="Re-read this link and refresh what we know about it"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isIndexing ? 'animate-spin' : ''}`} />
            </button>
          )}
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
          <div className="shrink-0">
            {/* A site that blocks framing can still be previewed from what we
                extracted — its own image, title and description. */}
            {enrichment?.imageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote host, outside next/image's configured domains */
              <img
                src={enrichment.imageUrl}
                alt=""
                className="w-full max-h-44 object-cover bg-background"
              />
            )}
            <div className="px-6 py-6 text-center">
              {!enrichment?.imageUrl && (
                <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-border flex items-center justify-center mx-auto mb-4">
                  {enrichment?.faviconUrl || hostname ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- tiny external favicon, not worth next/image */
                    <img
                      src={
                        enrichment?.faviconUrl ??
                        `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
                      }
                      alt=""
                      className="w-6 h-6 rounded"
                    />
                  ) : (
                    <Globe className="w-5 h-5 text-primary-light" />
                  )}
                </div>
              )}
              <p className="text-sm text-muted-light mb-1">
                {enrichment?.siteName || hostname || 'This link'}
              </p>
              <p className="text-xs text-muted mb-5 leading-relaxed">
                {enrichment?.description ??
                  (isIndexing
                    ? 'Reading this link…'
                    : "This site doesn't allow inline previews.")}
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
          </div>
        )}

        {/* What we know about this link — the searchable layer, made visible */}
        {(enrichment || isIndexing) && (
          <div className="border-t border-border px-3.5 py-3 shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-muted font-medium">
              About this link
            </span>
            {isIndexing ? (
              <p className="flex items-center gap-2 mt-2 text-xs text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-light shrink-0" />
                Opening the page and indexing what it says…
              </p>
            ) : indexFailed ? (
              <div className="mt-2">
                <p className="flex items-start gap-2 text-xs text-muted leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 mt-px" />
                  <span>
                    We couldn&apos;t read this page
                    {enrichment?.error ? ` — ${enrichment.error}` : ''}. It&apos;s saved and
                    searchable by title, just not by its contents.
                  </span>
                </p>
                {onReindex && (
                  <button
                    type="button"
                    onClick={() => onReindex(memory.id)}
                    className="inline-flex items-center gap-1.5 mt-2 text-[11px] text-primary-light hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Try again
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {embed && enrichment?.description && (
                  // With an embed above, the description is new information rather
                  // than a repeat of the fallback panel.
                  <p className="text-xs text-muted leading-relaxed line-clamp-4">
                    {enrichment.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                  {enrichment?.author && <span>By {enrichment.author}</span>}
                  {enrichment?.hasTranscript && (
                    <span className="inline-flex items-center gap-1 text-primary-light">
                      <Captions className="w-3 h-3" />
                      Transcript indexed
                    </span>
                  )}
                  {!!enrichment?.indexedChars && enrichment.indexedChars > 0 && (
                    <span>{enrichment.indexedChars.toLocaleString()} characters searchable</span>
                  )}
                </div>
                {!!enrichment?.keywords?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {enrichment.keywords.slice(0, 6).map((keyword) => (
                      <span
                        key={keyword}
                        className="text-[11px] px-2 py-0.5 bg-background border border-border rounded-full text-muted"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
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
