/**
 * The File Hug brand mark — a filled heart on a `--primary` rounded square.
 * Mirrors the Lucide `Heart` mark rendered in the landing footer, the login
 * page, and the app header. Kept here as raw values so the generated favicon
 * and apple-touch icon (which run through `next/og`, outside Tailwind and the
 * CSS custom properties) stay in sync with the UI.
 */

/** `--primary` from the dark theme — the mark reads the same on either theme. */
export const BRAND_PRIMARY = '#fb8b3d';

/** `--on-accent` from the dark theme — the heart drawn on top of the square. */
export const BRAND_ON_ACCENT = '#1b1206';

/** The `lucide-react` v1 `Heart` path, on a 24x24 viewBox. */
export const BRAND_HEART_PATH =
  'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5';
