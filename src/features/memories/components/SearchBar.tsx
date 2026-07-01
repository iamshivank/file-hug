'use client';

import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** `default` for the library-wide search; `compact` for in-group fields. */
  size?: 'default' | 'compact';
  /** Accessible label — defaults to the placeholder. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Reusable search input styled to match the app — a leading Search icon, a
 * primary focus ring, and a clear "×" once there's a query. Used both for the
 * global Library search and the per-platform-group search.
 */
export default function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  size = 'default',
  ariaLabel,
  className = '',
}: SearchBarProps) {
  const compact = size === 'compact';
  const iconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const height = compact ? 'py-1.5 text-sm' : 'py-2.5 text-sm';
  const leftPad = compact ? 'pl-8' : 'pl-9';

  return (
    <div className={`relative ${className}`}>
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 ${iconSize} text-muted pointer-events-none`}
        aria-hidden
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={`w-full ${leftPad} pr-9 ${height} rounded-xl bg-surface border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className={`absolute right-2 top-1/2 -translate-y-1/2 ${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer`}
        >
          <X className={iconSize} />
        </button>
      )}
    </div>
  );
}
