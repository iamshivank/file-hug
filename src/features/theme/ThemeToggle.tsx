'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'fh-theme';

/** The theme actually showing right now: an explicit choice, else the OS preference. */
function resolveTheme(): Resolved {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Light/dark switch. Defaults to following the OS (no [data-theme] set); a click
 * stamps an explicit choice on <html> and remembers it. The pre-paint script in
 * the root layout applies a saved choice before first paint (no flash).
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Resolved>('dark');

  useEffect(() => {
    setMounted(true);
    setTheme(resolveTheme());

    // Keep the icon in sync with the OS while the user is still following it.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (!document.documentElement.getAttribute('data-theme')) {
        setTheme(mq.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Resolved = resolveTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked — the toggle still works for this session */
    }
    setTheme(next);
  };

  // Before mount the resolved theme is unknown; show a stable, theme-agnostic icon.
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      suppressHydrationWarning
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'}
      title={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'}
      className={`w-9 h-9 rounded-lg flex items-center justify-center text-muted hover:text-primary-light hover:bg-surface-hover border border-border transition-colors cursor-pointer ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
