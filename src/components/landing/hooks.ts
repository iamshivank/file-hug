'use client';

import { useSyncExternalStore } from 'react';

const THEME_EVENT = 'fh-theme-change';

/** Subscribe to a media query. Renders `serverValue` during SSR + hydration. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}

export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

function resolveTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme actually showing — follows the ThemeToggle and the OS. */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', onChange);
      window.addEventListener(THEME_EVENT, onChange);
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      return () => {
        media.removeEventListener('change', onChange);
        window.removeEventListener(THEME_EVENT, onChange);
        observer.disconnect();
      };
    },
    resolveTheme,
    () => 'dark'
  );
}
