'use client';

import { useState, FormEvent } from 'react';
import { ArrowRight, Loader2, Link2, FileText } from 'lucide-react';
import { SaveMemoryInput } from '../types/memory.types';
import { detectContent } from '../utils/urlDetection';

interface SaveMemoryFormProps {
  onSave: (input: SaveMemoryInput) => Promise<boolean>;
  isSaving: boolean;
}

function formatDetectionLabel(content: string): { label: string; isUrl: boolean } | null {
  if (!content.trim()) return null;
  const { type, platform, subtype } = detectContent(content);
  if (type === 'note') return { label: 'Note', isUrl: false };
  if (platform && subtype) {
    const p = platform.charAt(0).toUpperCase() + platform.slice(1);
    const s = subtype.charAt(0).toUpperCase() + subtype.slice(1);
    return { label: `${p} ${s} detected`, isUrl: true };
  }
  return { label: 'URL detected', isUrl: true };
}

export default function SaveMemoryForm({ onSave, isSaving }: SaveMemoryFormProps) {
  const [content, setContent] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const detected = formatDetectionLabel(content);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim() || isSaving) return;

    const success = await onSave({ content: content.trim() });
    if (success) {
      setContent('');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  return (
    <div className="gradient-border p-6 rounded-2xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste a URL or write a thought you want to remember..."
          rows={3}
          maxLength={5000}
          className="w-full px-4 py-3 rounded-xl bg-background/60 border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none text-sm leading-relaxed"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            {detected ? (
              <>
                {detected.isUrl ? (
                  <Link2 className="w-3.5 h-3.5 text-primary-light" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-accent-light" />
                )}
                <span className={detected.isUrl ? 'text-primary-light' : 'text-accent-light'}>
                  {detected.label}
                </span>
              </>
            ) : (
              <span>URL or note — auto-detected</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving || !content.trim()}
            className="group flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : justSaved ? (
              '✓ Saved!'
            ) : (
              <>
                Save Memory
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
