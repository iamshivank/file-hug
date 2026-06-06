'use client';

import { useState, useEffect, useCallback } from 'react';
import { MemoryData, SaveMemoryInput, FetchResult, SaveResult } from '../types/memory.types';
import { DEMO_MEMORIES } from '../data/demoMemories';

const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true';

function detectTypeLocally(content: string): 'url' | 'note' {
  try {
    new URL(content.trim());
    return 'url';
  } catch {
    return 'note';
  }
}

function generateTitleLocally(content: string, type: 'url' | 'note'): string {
  if (type === 'url') {
    try {
      return new URL(content.trim()).hostname.replace('www.', '');
    } catch {
      return 'Saved URL';
    }
  }
  const trimmed = content.trim();
  return trimmed.length > 60 ? trimmed.slice(0, 60) + '...' : trimmed;
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
      const type = detectTypeLocally(input.content);
      const newMemory: MemoryData = {
        _id: `demo-${Date.now()}`,
        content: input.content.trim(),
        type,
        title: generateTitleLocally(input.content.trim(), type),
        tags: [],
        createdAt: new Date().toISOString(),
      };
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
