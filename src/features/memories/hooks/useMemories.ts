'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MemoryData,
  MemoryEnrichment,
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

  const detected = detectContent(content);
  const customTags = (input.tags ?? [])
    .map((tag) => tag.trim().toLowerCase().replace(/^#/, ''))
    .filter((tag) => tag.length > 0 && tag.length <= 30);
  return {
    id: `demo-${Date.now()}`,
    // Store the normalised URL so `instagram.com/reel/x` still embeds and previews.
    content: detected.type === 'url' ? detected.url : content,
    type: detected.type,
    title: input.title?.trim() || detected.title,
    tags: [...new Set([...detected.tags, ...customTags])].slice(0, 10),
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

/**
 * Put `updated` into the list and mirror its connection changes onto the other
 * side, the way the server does. Without the mirror, connecting a note to a link
 * only showed up on the note until the next full reload.
 */
function withUpdatedMemory(list: MemoryData[], updated: MemoryData, prevLinks: string[]): MemoryData[] {
  const nextLinks = updated.linkedMemoryIds ?? [];
  const added = nextLinks.filter((id) => !prevLinks.includes(id));
  const removed = prevLinks.filter((id) => !nextLinks.includes(id));
  return list.map((m) => {
    if (m.id === updated.id) return updated;
    if (added.includes(m.id)) return withConnection(m, updated.id);
    if (removed.includes(m.id)) {
      return { ...m, linkedMemoryIds: (m.linkedMemoryIds ?? []).filter((x) => x !== updated.id) };
    }
    return m;
  });
}

/** How often to re-check for links still being read, and how many times. */
const ENRICHMENT_POLL_MS = 4000;
const ENRICHMENT_POLL_LIMIT = 75;

/**
 * @param options.localOnly Keep everything in the browser, as in demo mode. A
 *   demo *session* (in a deployment that otherwise uses the database) must set
 *   this: the API ignores demo users, so reads come back empty and writes are
 *   refused.
 */
export function useMemories(options: { localOnly?: boolean } = {}) {
  const isDemo = IS_DEMO || (options.localOnly ?? false);
  const [memories, setMemories] = useState<MemoryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  // Bumped on every local change. A background poll that started before a
  // change would otherwise land after it and overwrite it with older data — a
  // just-saved memory vanishing, or a reindex spinner snapping back.
  const localVersion = useRef(0);

  /**
   * `silent` refreshes skip the loading state, so background polling for
   * enrichment never flashes the library's spinner over content the user is
   * already reading.
   */
  const fetchMemories = useCallback(async (options: { silent?: boolean } = {}) => {
    const silent = options.silent ?? false;
    if (!silent) {
      setIsLoading(true);
      // Background polls must not wipe an error the user hasn't read yet.
      setError(null);
    }

    if (isDemo) {
      setMemories(DEMO_MEMORIES);
      setIsLoading(false);
      return;
    }

    const startedAt = localVersion.current;
    try {
      const res = await fetch('/api/memories');
      const json: FetchResult = await res.json();
      if (silent && localVersion.current !== startedAt) return;
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
  }, [isDemo]);

  useEffect(() => {
    const timer = window.setTimeout(fetchMemories, 0);
    return () => window.clearTimeout(timer);
  }, [fetchMemories]);

  // Links are indexed after the save response is sent, so a freshly saved link
  // arrives as `pending`. Poll until it resolves, then stop. Bounded so a link
  // that never finishes (service down) cannot poll forever, and ignoring rows that
  // have already stalled so an old abandoned row can't restart the loop.
  const pendingCount = memories.filter((m) => enrichmentState(m.enrichment) === 'indexing').length;
  useEffect(() => {
    if (isDemo || pendingCount === 0) return;

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
  }, [pendingCount, fetchMemories, isDemo]);

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

    if (isDemo) {
      const newMemory = buildLocalMemory(input);
      localVersion.current += 1;
      // Mirror the new memory's connections onto its targets.
      setMemories((prev) => withUpdatedMemory([newMemory, ...prev], newMemory, []));
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
        const saved = json.data.memory;
        localVersion.current += 1;
        // The server mirrored the connections; reflect that on the targets too.
        setMemories((prev) => withUpdatedMemory([saved, ...prev], saved, []));
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
  }, [isDemo]);

  const update = useCallback(async (input: UpdateMemoryInput): Promise<boolean> => {
    if (!input.id) return false;
    setError(null);

    if (isDemo) {
      localVersion.current += 1;
      setMemories((prev) => {
        const target = prev.find((m) => m.id === input.id);
        if (!target) return prev;
        return withUpdatedMemory(prev, applyLocalUpdate(target, input), target.linkedMemoryIds ?? []);
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
        const fromServer = json.data.memory;
        localVersion.current += 1;
        setMemories((prev) => {
          const target = prev.find((m) => m.id === fromServer.id);
          if (!target) return prev;
          // An update response only carries `enrichment` when the edit changed it
          // (a new URL). Otherwise keep what we had — replacing the memory
          // wholesale used to wipe a link's preview on every connection edit.
          const updated: MemoryData =
            'enrichment' in fromServer ? fromServer : { ...fromServer, enrichment: target.enrichment };
          return withUpdatedMemory(prev, updated, target.linkedMemoryIds ?? []);
        });
        return true;
      } else {
        setError(json.error ?? 'Failed to update.');
        return false;
      }
    } catch {
      setError('Network error. Please try again.');
      return false;
    }
  }, [isDemo]);

  /**
   * Re-open a link and rebuild its search index, then merge the fresh enrichment
   * in place. Used by the retry affordance on a link whose first read failed.
   */
  const reindex = useCallback(async (id: string): Promise<boolean> => {
    if (isDemo) return false;
    setReindexingId(id);
    setError(null);

    // Show the in-flight state on the card itself while the fetch runs, keeping
    // what we knew so it can be restored if nothing changes.
    let previous: MemoryEnrichment | null | undefined;
    localVersion.current += 1;
    setMemories((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        previous = m.enrichment;
        return { ...m, enrichment: { status: 'pending' as const } };
      })
    );
    const settle = (enrichment: MemoryEnrichment | null | undefined) => {
      localVersion.current += 1;
      setMemories((prev) => prev.map((m) => (m.id === id ? { ...m, enrichment } : m)));
    };

    try {
      const res = await fetch('/api/memories/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const json: SaveResult = await res.json();
      if (json.success && json.data) {
        const updated = json.data.memory;
        localVersion.current += 1;
        setMemories((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        return true;
      }
      setError(json.error ?? 'Failed to re-read this link.');
      if (res.status === 503) {
        // Indexing is switched off for this deployment — nothing was attempted,
        // so the link is exactly as it was.
        settle(previous);
      } else {
        // Reflect the failure on the card rather than leaving it stuck on pending.
        settle({ ...previous, status: 'failed', error: json.error ?? null });
      }
      return false;
    } catch {
      setError('Network error. Please try again.');
      settle({ ...previous, status: 'failed' });
      return false;
    } finally {
      setReindexingId(null);
    }
  }, [isDemo]);

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
