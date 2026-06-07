'use client';

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';
import {
  ArrowUp,
  Loader2,
  Link2,
  FileText,
  Check,
  ClipboardPaste,
  Sparkles,
} from 'lucide-react';
import { SaveMemoryInput } from '../types/memory.types';
import { detectContent } from '../utils/urlDetection';
import PlatformIcon from './PlatformIcon';

interface SaveMemoryFormProps {
  onSave: (input: SaveMemoryInput) => Promise<boolean>;
  isSaving: boolean;
}

type Mode = 'link' | 'note';

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function SaveMemoryForm({ onSave, isSaving }: SaveMemoryFormProps) {
  const [mode, setMode] = useState<Mode>('link');
  const [url, setUrl] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const [modKey, setModKey] = useState('Ctrl');
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)) {
      setModKey('⌘');
    }
  }, []);

  const detection = mode === 'link' && url.trim() ? detectContent(url) : null;
  const isNoteLike = detection?.type === 'note';
  const canSave = mode === 'link' ? !!url.trim() : !!noteBody.trim();

  const flashSaved = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const submit = async () => {
    if (!canSave || isSaving) return;
    const input: SaveMemoryInput =
      mode === 'link'
        ? { content: url.trim() }
        : { content: noteBody.trim(), title: noteTitle.trim(), type: 'note' };

    const success = await onSave(input);
    if (success) {
      setUrl('');
      setNoteTitle('');
      setNoteBody('');
      flashSaved();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit();
  };

  const handleBodyKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setMode('link');
        setUrl(text.trim());
      }
    } catch {
      /* clipboard blocked — user can paste manually */
    }
    urlRef.current?.focus();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    if (m === 'link') setTimeout(() => urlRef.current?.focus(), 0);
  };

  const tabClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
      active ? 'bg-primary text-background shadow-sm shadow-primary/30' : 'text-muted hover:text-foreground'
    }`;

  const sendButton = (
    <button
      type="submit"
      disabled={isSaving || !canSave}
      aria-label="Save"
      className="w-10 h-10 rounded-full bg-primary hover:bg-primary-light text-background flex items-center justify-center transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 cursor-pointer"
    >
      {isSaving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : justSaved ? (
        <Check className="w-4 h-4" />
      ) : (
        <ArrowUp className="w-4 h-4" />
      )}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Colorful warm glow behind the bar */}
      <div className="composer-aura" aria-hidden />

      {/* Mode toggle — clearly separated above the bar */}
      <div className="flex justify-center mb-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border">
          <button type="button" onClick={() => switchMode('link')} className={tabClass(mode === 'link')}>
            <Link2 className="w-4 h-4" />
            Link
          </button>
          <button type="button" onClick={() => switchMode('note')} className={tabClass(mode === 'note')}>
            <FileText className="w-4 h-4" />
            Note
          </button>
        </div>
      </div>

      {/* The bar */}
      {mode === 'link' ? (
        <div className="composer flex items-center gap-2 pl-4 pr-2 py-2">
          <div className="text-primary-light shrink-0">
            <PlatformIcon
              platform={detection?.platform ?? null}
              type={isNoteLike ? 'note' : 'url'}
              className="w-5 h-5"
            />
          </div>
          <input
            ref={urlRef}
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link — a reel, article, tweet, video…"
            autoFocus
            className="flex-1 min-w-0 bg-transparent border-0 outline-none py-2.5 text-base sm:text-lg text-foreground placeholder:text-muted"
          />
          <button
            type="button"
            onClick={handlePaste}
            aria-label="Paste from clipboard"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm text-muted hover:text-primary-light hover:bg-surface-hover transition-colors shrink-0 cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste
          </button>
          {sendButton}
        </div>
      ) : (
        <div className="composer p-2">
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={200}
            className="w-full bg-transparent border-0 outline-none px-3 pt-2.5 pb-1 text-lg font-display placeholder:font-sans placeholder:text-muted text-foreground"
          />
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            onKeyDown={handleBodyKeyDown}
            placeholder="Write a thought you want to remember…"
            rows={4}
            maxLength={5000}
            className="w-full bg-transparent border-0 outline-none px-3 py-1 text-foreground placeholder:text-muted resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between gap-3 px-2 pt-1">
            <span className="text-xs text-muted tabular-nums">{noteBody.length}/5000</span>
            <button
              type="submit"
              disabled={isSaving || !canSave}
              className="group inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-light text-background text-sm font-semibold rounded-full transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving…
                </>
              ) : justSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved
                </>
              ) : (
                'Save note'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Hint below the bar */}
      <div className="flex items-center justify-center gap-2 mt-3 h-5 text-xs text-muted">
        {mode === 'link' ? (
          detection ? (
            isNoteLike ? (
              <span>
                That looks like text —{' '}
                <button
                  type="button"
                  onClick={() => switchMode('note')}
                  className="text-primary-light hover:underline cursor-pointer"
                >
                  write it as a note
                </button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-primary-light">
                <Sparkles className="w-3.5 h-3.5" />
                {detection.platform && detection.subtype
                  ? `${titleCase(detection.platform)} ${titleCase(detection.subtype)} detected`
                  : 'Link detected'}
              </span>
            )
          ) : (
            <span>Paste a link, or switch to a note. Press Enter to save.</span>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5">
            Press <kbd className="kbd">{modKey} ⏎</kbd> to save
          </span>
        )}
      </div>
    </form>
  );
}
