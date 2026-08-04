import 'server-only';

/**
 * Whether the memory-intelligence service is wired up at all.
 *
 * The service is a separate long-running Python process, so plenty of valid
 * deployments won't have one — a Vercel-only prod, a fresh clone, CI. Those must
 * behave exactly like the app did before link intelligence existed, not like a
 * broken version of it.
 *
 * So configuration is explicit: **no `INTELLIGENCE_SERVICE_URL` means the feature
 * is off.** There is no localhost default, because falling back to localhost in a
 * serverless environment points the app at itself and turns "feature absent" into
 * "feature permanently loading".
 *
 * Set `INTELLIGENCE_SERVICE_URL` to the service's base URL (no trailing slash) to
 * turn it on — e.g. `https://filehug-intelligence.up.railway.app`, or
 * `http://localhost:8000` for local development.
 */

const RAW_URL = process.env.INTELLIGENCE_SERVICE_URL?.trim();

/** The service base URL with any trailing slash removed, or null when unset. */
export const INTELLIGENCE_SERVICE_URL: string | null =
  RAW_URL && RAW_URL.length > 0 ? RAW_URL.replace(/\/+$/, '') : null;

/** True when the app is configured to talk to the intelligence service. */
export function isIntelligenceEnabled(): boolean {
  return INTELLIGENCE_SERVICE_URL !== null;
}
