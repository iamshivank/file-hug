'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight, Loader2, Link2, FileText, Check } from 'lucide-react';
import { SaveMemoryInput } from '../types/memory.types';
import { detectContent } from '../utils/urlDetection';

interface SaveMemoryFormProps {
  onSave: (input: SaveMemoryInput) => Promise<boolean>;
  isSaving: boolean;
}

type Mode = 'link' | 'note';

function linkLabel(url: string): string | null {
  if (!url.trim()) return null;
  const { type, platform, subtype } = detectContent(url);
  if (type === 'note') return 'Looks like a note — switch to the Note tab';
  if (platform && subtype) {
    const p = platform.charAt(0).toUpperCase() + platform.slice(1);
    const s = subtype.charAt(0).toUpperCase() + subtype.slice(1);
    return `${p} ${s} detected`;
  }
  return 'Link detected';
}

export default function SaveMemoryForm({ onSave, isSaving }: SaveMemoryFormProps) {
  const [mode, setMode] = useState<Mode>('link');
  const [url, setUrl] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const detected = mode === 'link' ? linkLabel(url) : null;
  const canSave = mode === 'link' ? !!url.trim() : !!noteBody.trim();

  const flashSaved = () => {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

  const tabClass = (active: boolean) =>
    `flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
      active
        ? 'bg-primary/15 text-primary-light border border-border-strong'
        : 'text-muted hover:text-foreground border border-transparent'
    }`;

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all text-sm';

  return (
    <div className="gradient-border p-5 sm:p-6 rounded-2xl">
      {/* Mode toggle */}
      <div className="flex items-center gap-1.5 mb-4">
        <button type="button" onClick={() => setMode('link')} className={tabClass(mode === 'link')}>
          <Link2 className="w-4 h-4" />
          Link
        </button>
        <button type="button" onClick={() => setMode('note')} className={tabClass(mode === 'note')}>
          <FileText className="w-4 h-4" />
          Note
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'link' ? (
          <>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a link — a reel, article, tweet, video..."
              className={inputClass}
            />
            <div className="flex items-center gap-1.5 text-xs h-4">
              {detected && (
                <>
                  <Link2 className="w-3.5 h-3.5 text-primary-light" />
                  <span className="text-primary-light">{detected}</span>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title (optional)"
              maxLength={200}
              className={inputClass}
            />
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Write a thought you want to remember..."
              rows={4}
              maxLength={5000}
              className={`${inputClass} resize-none leading-relaxed`}
            />
          </>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSaving || !canSave}
            className="group inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-light text-background text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/35 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : justSaved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                {mode === 'link' ? 'Save link' : 'Save note'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
