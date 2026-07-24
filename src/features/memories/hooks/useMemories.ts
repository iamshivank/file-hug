'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MemoryData,
  SaveMemoryInput,
  UpdateMemoryInput,
  FetchResult,
  SaveResult,
} from '../types/memory.types';
import { DEMO_MEMORIES } from '../data/demoMemories';
import { detectContent } from '../utils/urlDetection';

const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true';

function buildLocalMemory(input: SaveMemoryInput): MemoryData {
  const content = input.content.trim();

  if (input.type === 'note') {
    const firstLine = content.split('\n')[0].trim();
    const title =
      input.title?.trim() ||
      (firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine || 'Untitled note');
    return {
      id: `demo-${Date.now()}`,
      content,
      type: 'note',
      title,
      tags: ['note'],
      linkedMemoryIds: input.linkedMemoryIds ?? [],
      createdAt: new Date().toISOString(),
    };
  }

  const { type, title, tags } = detectContent(content);
  return {
    id: `demo-${Date.now()}`,
    content,
    type,
    title,
    tags,
    createdAt: new Date().toISOString(),
  };
}

function noteTitleFrom(body: string): string {
  const firstLine = body.trim().split('\n')[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine || 'Untitled note';
}

/** Mirror of the server update, used only in demo mode (no DB). */
function applyLocalUpdate(memory: MemoryData, input: UpdateMemoryInput): MemoryData {
  const next: MemoryData = { ...memory, updatedAt: new Date().toISOString() };
  if (input.content !== undefined) next.content = input.content.trim();
  if (input.title !== undefined) {
    next.title = input.title.trim() || noteTitleFrom(next.content);
  }
  // Connections are bidirectional and apply to both notes and links.
  if (input.linkedMemoryIds !== undefined) {
    next.linkedMemoryIds = input.linkedMemoryIds;
  }
  return next;
}

/** Add `otherId` to a memory's connections without duplicates (demo mirroring). */
function withConnection(memory: MemoryData, otherId: string): MemoryData {
  return { ...memory, linkedMemoryIds: [...new Set([...(memory.linkedMemoryIds ?? []), otherId])] };
}

export function useMemories() {
  const [memories, setMemories] = useState<MemoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    if (IS_DEMO) {
      setMemories(DEMO_MEMORIES);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/memories');
      const json: FetchResult = await res.json();
      if (json.success && json.data) {
        setMemories(json.data.memories);
      } else {
        setError(json.error ?? 'Failed to load memories.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const save = useCallback(async (input: SaveMemoryInput): Promise<boolean> => {
    // Notes may be title-only (empty body); links always need content.
    const hasContent = !!input.content.trim();
    if (input.type === 'note') {
      if (!hasContent && !input.title?.trim()) return false;
    } else if (!hasContent) {
      return false;
    }
    setIsSaving(true);
    setError(null);

    if (IS_DEMO) {
      const newMemory = buildLocalMemory(input);
      const links = newMemory.linkedMemoryIds ?? [];
      setMemories((prev) => [
        newMemory,
        // Mirror the new memory's connections onto its targets.
        ...prev.map((m) => (links.includes(m.id) ? withConnection(m, newMemory.id) : m)),
      ]);
      setIsSaving(false);
      return true;
    }

    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json: SaveResult = await res.json();
      if (json.success && json.data) {
        setMemories((prev) => [json.data!.memory, ...prev]);
        return true;
      } else {
        setError(json.error ?? 'Failed to save.');
        return false;
      }
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const update = useCallback(async (input: UpdateMemoryInput): Promise<boolean> => {
    if (!input.id) return false;
    setError(null);

    if (IS_DEMO) {
      setMemories((prev) => {
        const target = prev.find((m) => m.id === input.id);
        if (!target) return prev;
        const updated = applyLocalUpdate(target, input);
        const prevLinks = target.linkedMemoryIds ?? [];
        const nextLinks = updated.linkedMemoryIds ?? [];
        const added = nextLinks.filter((id) => !prevLinks.includes(id));
        const removed = prevLinks.filter((id) => !nextLinks.includes(id));
        return prev.map((m) => {
          if (m.id === updated.id) return updated;
          if (added.includes(m.id)) return withConnection(m, updated.id);
          if (removed.includes(m.id)) {
            return { ...m, linkedMemoryIds: (m.linkedMemoryIds ?? []).filter((x) => x !== updated.id) };
          }
          return m;
        });
      });
      return true;
    }

    try {
      const res = await fetch('/api/memories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json: SaveResult = await res.json();
      if (json.success && json.data) {
        const updated = json.data.memory;
        setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        return true;
      } else {
        setError(json.error ?? 'Failed to update.');
        return false;
      }
    } catch {
      setError('Network error. Please try again.');
      return false;
    }
  }, []);

  return { memories, isLoading, error, isSaving, save, update, refresh: fetchMemories };
}
