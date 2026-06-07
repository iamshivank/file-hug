'use client';

import { Loader2 } from 'lucide-react';
import { useMemories } from '../hooks/useMemories';
import SaveMemoryForm from './SaveMemoryForm';
import MemoryCard from './MemoryCard';
import EmptyState from './EmptyState';

export default function MemoryDashboard() {
  const { memories, isLoading, error, isSaving, save } = useMemories();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
      {/* Intro */}
      <header>
        <h1 className="font-display text-3xl sm:text-4xl text-foreground mb-2">
          Your memory, kept warm.
        </h1>
        <p className="text-muted-light">
          Drop in a link or a note. File Hug files it away so you can find it later.
        </p>
      </header>

      {/* Save */}
      <SaveMemoryForm onSave={save} isSaving={isSaving} />

      {/* Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-[0.15em]">
            {isLoading ? 'Loading' : `Saved (${memories.length})`}
          </h2>
        </div>

        {error && (
          <p className="text-danger text-sm mb-6 card px-4 py-3">{error}</p>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : memories.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {memories.map((memory) => (
              <MemoryCard key={memory._id} memory={memory} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
