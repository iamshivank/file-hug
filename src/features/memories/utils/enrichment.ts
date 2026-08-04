import { MemoryEnrichment } from '../types/memory.types';

/**
 * How long a link may sit in `pending` before we stop calling it "in progress".
 *
 * Indexing normally finishes in seconds. A row still pending well past that means
 * the attempt died somewhere we don't control — the service was killed mid-fetch,
 * a serverless invocation was cut short, the process crashed. Nothing will ever
 * come back to update the row, so showing a spinner forever would be a lie.
 */
const STALE_PENDING_MS = 5 * 60 * 1000;

/**
 * What the UI should actually show for a memory's enrichment.
 *
 * `none` — nothing to say (a note, or a deployment with indexing switched off).
 * `indexing` — genuinely in flight.
 * `stalled` — pending long enough that nobody is coming; offer a retry.
 * `ready` / `failed` — the indexer reached a verdict.
 */
export type EnrichmentState = 'none' | 'indexing' | 'stalled' | 'ready' | 'failed';

export function enrichmentState(
  enrichment: MemoryEnrichment | null | undefined,
  now: number = Date.now()
): EnrichmentState {
  if (!enrichment) return 'none';
  if (enrichment.status === 'ready') return 'ready';
  if (enrichment.status === 'failed') return 'failed';

  // Pending: in flight, or abandoned?
  const stamp = enrichment.updatedAt ?? enrichment.fetchedAt;
  if (!stamp) return 'indexing';
  const age = now - new Date(stamp).getTime();
  // A negative age means clock skew between server and browser — treat it as
  // fresh rather than instantly declaring a brand-new row stalled.
  if (Number.isNaN(age) || age < STALE_PENDING_MS) return 'indexing';
  return 'stalled';
}
