'use client';

import { useState, useEffect, useCallback } from 'react';
import { MemoryData, SaveMemoryInput, FetchResult, SaveResult } from '../types/memory.types';
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
    if (!input.content.trim()) return false;
    setIsSaving(true);
    setError(null);

    if (IS_DEMO) {
      const newMemory = buildLocalMemory(input);
      setMemories((prev) => [newMemory, ...prev]);
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

  return { memories, isLoading, error, isSaving, save, refresh: fetchMemories };
}
