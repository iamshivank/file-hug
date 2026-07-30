'use client';

import { useEffect, useMemo, useState } from 'react';
import { MemoryData } from '../types/memory.types';
import { applyRanking, filterMemories } from '../utils/search';

const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true';

/** Below this length a query is too vague to be worth a round trip. */
const MIN_QUERY_LENGTH = 2;

/** Typing pause before searching — long enough to avoid a request per keystroke. */
const DEBOUNCE_MS = 250;

/** Which signals produced the ranking, mirrored from the service's response. */
export type SearchMode = 'hybrid' | 'semantic' | 'fts' | 'ilike' | 'local';

export interface SmartSearchState {
  /** Memories matching the query, best first. Everything when the query is blank. */
  results: MemoryData[];
  /** True while a server search is in flight (local results show meanwhile). */
  isSearching: boolean;
  /** How the current results were produced — `local` means client-side only. */
  mode: SearchMode;
  /** True when the ranking used content extracted from the links themselves. */
  usedLinkIndex: boolean;
  /** Set when the server search could not be used; results fell back to local. */
  notice: string | null;
}

interface ServerSearchResponse {
  mode?: string;
  used_link_index?: boolean;
  results?: { id: string }[];
}

/** A completed server search, tagged with the query it answers. */
interface Ranking {
  query: string;
  ids: string[];
  mode: SearchMode;
  usedLinkIndex: boolean;
}

/** A server search that could not be used, tagged with the query it answers. */
interface Failure {
  query: string;
  notice: string | null;
}

function isSearchMode(value: string): value is Exclude<SearchMode, 'local'> {
  return value === 'hybrid' || value === 'semantic' || value === 'fts' || value === 'ilike';
}

function isSearchable(query: string): boolean {
  return !IS_DEMO && query.length >= MIN_QUERY_LENGTH;
}

/**
 * Search the user's library, preferring the intelligence service's hybrid ranking
 * and falling back to client-side filtering.
 *
 * The fallback is the point: the service is an optional companion process, and a
 * search box that goes dead when it is not running would be worse than one that
 * quietly does less. Local filtering renders immediately on every keystroke, and
 * the server's ranking replaces it when (and only when) it arrives. Demo mode
 * never leaves the browser.
 *
 * Every piece of server state is tagged with the query it answers and only
 * applied when that still matches what is typed. That makes stale responses
 * inert by construction — a slow answer for an earlier query simply never
 * matches again — instead of relying on cleanup ordering.
 */
export function useSmartSearch(memories: MemoryData[], query: string): SmartSearchState {
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [searchingQuery, setSearchingQuery] = useState<string | null>(null);
  // Set once the server reports the feature isn't configured here. Latches so we
  // stop issuing a request per keystroke for something that will never answer.
  const [unavailable, setUnavailable] = useState(false);

  const trimmed = query.trim();

  useEffect(() => {
    if (unavailable || !isSearchable(trimmed)) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchingQuery(trimmed);
      try {
        const res = await fetch(
          `/api/intelligence/search?q=${encodeURIComponent(trimmed)}&limit=100`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          // Local filtering has the user covered in every case, so the only
          // question is whether to say anything:
          //   503 — intelligence isn't configured for this deployment. Expected
          //         state, not a fault; say nothing at all.
          //   502 — configured but unreachable. Worth a quiet note.
          //   401 — session not accepted. Nothing the user can act on here.
          if (res.status === 503) {
            // Stop retrying for the rest of the session — it won't appear.
            setUnavailable(true);
          }
          setFailure({
            query: trimmed,
            notice:
              res.status === 502 ? 'Smart search is offline — showing basic matches.' : null,
          });
          return;
        }

        const json: ServerSearchResponse = await res.json();
        setRanking({
          query: trimmed,
          ids: (json.results ?? []).map((result) => result.id),
          mode: json.mode && isSearchMode(json.mode) ? json.mode : 'local',
          usedLinkIndex: !!json.used_link_index,
        });
      } catch (error) {
        // AbortError is the expected outcome of superseding a request.
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFailure({
          query: trimmed,
          notice: 'Smart search is offline — showing basic matches.',
        });
      } finally {
        setSearchingQuery((current) => (current === trimmed ? null : current));
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, unavailable]);

  // Server state only counts while it still answers what is typed.
  const activeRanking = ranking?.query === trimmed ? ranking : null;
  const activeFailure = failure?.query === trimmed ? failure : null;

  const results = useMemo(() => {
    if (!trimmed) return memories;
    // Ranking is applied against the live `memories` array, so in-flight edits and
    // newly arrived enrichment stay visible in the ranked list.
    if (activeRanking) return applyRanking(memories, activeRanking.ids);
    return filterMemories(memories, trimmed);
  }, [memories, trimmed, activeRanking]);

  return {
    results,
    isSearching: !unavailable && searchingQuery === trimmed && isSearchable(trimmed),
    mode: activeRanking?.mode ?? 'local',
    usedLinkIndex: activeRanking?.usedLinkIndex ?? false,
    notice: activeFailure?.notice ?? null,
  };
}
