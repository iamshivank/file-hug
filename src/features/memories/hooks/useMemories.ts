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
import { enrichmentState } from '../utils/enrichment';
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

  const { type, title, tags, url } = detectContent(content);
  return {
    id: `demo-${Date.now()}`,
    // Store the normalised URL so `instagram.com/reel/x` still embeds and previews.
    content: type === 'url' ? url : content,
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

/** How often to re-check for links still being read, and how many times. */
const ENRICHMENT_POLL_MS = 4000;
const ENRICHMENT_POLL_LIMIT = 6;

export function useMemories() {
  const [memories, setMemories] = useState<MemoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  /**
   * `silent` refreshes skip the loading state, so background polling for
   * enrichment never flashes the library's spinner over content the user is
   * already reading.
   */
  const fetchMemories = useCallback(async (options: { silent?: boolean } = {}) => {
    const silent = options.silent ?? false;
    if (!silent) setIsLoading(true);
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
      } else if (!silent) {
        setError(json.error ?? 'Failed to load memories.');
      }
    } catch {
      // A failed background poll is not worth interrupting the user over — the
      // next one may well succeed, and the stale list is still perfectly usable.
      if (!silent) setError('Network error. Please try again.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Links are indexed after the save response is sent, so a freshly saved link
  // arrives as `pending`. Poll until it resolves, then stop. Bounded so a link
  // that never finishes (service down) cannot poll forever, and ignoring rows that
  // have already stalled so an old abandoned row can't restart the loop.
  const pendingCount = memories.filter((m) => enrichmentState(m.enrichment) === 'indexing').length;
  useEffect(() => {
    if (IS_DEMO || pendingCount === 0) return;

    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (attempts > ENRICHMENT_POLL_LIMIT) {
        clearInterval(interval);
        return;
      }
      fetchMemories({ silent: true });
    }, ENRICHMENT_POLL_MS);

    return () => clearInterval(interval);
  }, [pendingCount, fetchMemories]);

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

  /**
   * Re-open a link and rebuild its search index, then merge the fresh enrichment
   * in place. Used by the retry affordance on a link whose first read failed.
   */
  const reindex = useCallback(async (id: string): Promise<boolean> => {
    if (IS_DEMO) return false;
    setReindexingId(id);
    setError(null);

    // Show the in-flight state on the card itself while the fetch runs.
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enrichment: { status: 'pending' as const } } : m))
    );

    try {
      const res = await fetch('/api/memories/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json: SaveResult = await res.json();
      if (json.success && json.data) {
        const updated = json.data.memory;
        setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        return true;
      }
      setError(json.error ?? 'Failed to re-read this link.');
      // Reflect the failure on the card rather than leaving it stuck on pending.
      setMemories((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, enrichment: { status: 'failed' as const, error: json.error ?? null } }
            : m
        )
      );
      return false;
    } catch {
      setError('Network error. Please try again.');
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enrichment: { status: 'failed' as const } } : m))
      );
      return false;
    } finally {
      setReindexingId(null);
    }
  }, []);

  return {
    memories,
    isLoading,
    error,
    isSaving,
    reindexingId,
    save,
    update,
    reindex,
    refresh: fetchMemories,
  };
}
