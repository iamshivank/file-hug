'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useMemories } from '../hooks/useMemories';
import { MemoryData } from '../types/memory.types';
import SaveMemoryForm from './SaveMemoryForm';
import MemoryCard from './MemoryCard';
import EmptyState from './EmptyState';
import LinkPreview from './LinkPreview';
import NotePreview from './NotePreview';

type Filter = 'all' | 'links' | 'notes';

export default function MemoryDashboard() {
  const { memories, isLoading, error, isSaving, save, update } = useMemories();
  const [filter, setFilter] = useState<Filter>('all');
  const [preview, setPreview] = useState<MemoryData | null>(null);
  const [activeNote, setActiveNote] = useState<{ id: string; edit: boolean } | null>(null);

  const links = memories.filter((m) => m.type === 'url');
  const notes = memories.filter((m) => m.type === 'note');
  const filtered = filter === 'links' ? links : filter === 'notes' ? notes : memories;

  const linksById = new Map(links.map((l) => [l.id, l]));
  const connectedLinksFor = (memory: MemoryData): MemoryData[] =>
    (memory.linkedMemoryIds ?? [])
      .map((id) => linksById.get(id))
      .filter((l): l is MemoryData => !!l);

  // Resolve by id so the open note reflects edits as `memories` updates.
  const activeNoteMemory = activeNote
    ? memories.find((m) => m.id === activeNote.id) ?? null
    : null;

  const openLinkFromNote = (link: MemoryData) => {
    setActiveNote(null);
    setPreview(link);
  };

  const filterTabs: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: memories.length },
    { key: 'links', label: 'Links', count: links.length },
    { key: 'notes', label: 'Notes', count: notes.length },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      {/* Hero intro */}
      <header className="text-center max-w-2xl mx-auto mb-9">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted-light mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          Your personal memory vault
        </div>
        <h1 className="font-display text-4xl sm:text-5xl text-foreground leading-[1.1] mb-3">
          Keep everything.{' '}
          <span className="gradient-text italic">Find it later.</span>
        </h1>
        <p className="text-muted-light text-lg">
          Drop in a link or a note — File Hug remembers, so you don&apos;t have to.
        </p>
      </header>

      {/* Composer — the centerpiece */}
      <div className="max-w-2xl mx-auto mb-20">
        <SaveMemoryForm onSave={save} isSaving={isSaving} savedLinks={links} />
      </div>

      {/* Library */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <h2 className="font-display text-2xl text-foreground">Library</h2>

          {memories.length > 0 && (
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    filter === tab.key
                      ? 'bg-primary/15 text-primary-light'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {tab.label}
                  <span className="text-xs text-muted tabular-nums">{tab.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-danger text-sm mb-6 card px-4 py-3">{error}</p>}

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : memories.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <p className="text-muted text-sm text-center py-16 card">
            No {filter} saved yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onOpen={
                  memory.type === 'url'
                    ? () => setPreview(memory)
                    : () => setActiveNote({ id: memory.id, edit: false })
                }
                onEdit={
                  memory.type === 'note'
                    ? () => setActiveNote({ id: memory.id, edit: true })
                    : undefined
                }
                connectedLinks={memory.type === 'note' ? connectedLinksFor(memory) : undefined}
                onOpenConnected={setPreview}
              />
            ))}
          </div>
        )}
      </section>

      {preview && <LinkPreview memory={preview} onClose={() => setPreview(null)} />}
      {activeNoteMemory && (
        <NotePreview
          key={activeNoteMemory.id}
          memory={activeNoteMemory}
          startInEdit={activeNote?.edit ?? false}
          connectedLinks={connectedLinksFor(activeNoteMemory)}
          savedLinks={links}
          onClose={() => setActiveNote(null)}
          onOpenLink={openLinkFromNote}
          onSave={update}
        />
      )}
    </div>
  );
}
