'use client';

import { Loader2 } from 'lucide-react';
import { useMemories } from '../hooks/useMemories';
import SaveMemoryForm from './SaveMemoryForm';
import MemoryCard from './MemoryCard';
import EmptyState from './EmptyState';

export default function MemoryDashboard() {
  const { memories, isLoading, error, isSaving, save } = useMemories();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Save */}
      <section>
        <p className="text-xs font-semibold text-muted-light uppercase tracking-widest mb-4">
          Save a Memory
        </p>
        <SaveMemoryForm onSave={save} isSaving={isSaving} />
      </section>

      {/* Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-muted-light uppercase tracking-widest">
            {isLoading ? 'Loading...' : `Your Memories (${memories.length})`}
          </p>
        </div>

        {error && (
          <p className="text-red-400 text-sm mb-6 glass px-4 py-3 rounded-xl">{error}</p>
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
