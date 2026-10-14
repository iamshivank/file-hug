'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, Search, Sparkles, X } from 'lucide-react';
import PlatformIcon from '@/features/memories/components/PlatformIcon';
import { useReducedMotion } from './hooks';
import { agoLabel, DEMO_MEMORIES, searchMemories } from './searchDemoData';
import TiltCard from './TiltCard';

const SUGGESTIONS = [
  'that sourdough reel from last month',
  'something to cook tonight',
  'funny thing about tabs',
  'how should I price my app',
  'gift for anya',
  '3d inspiration',
];

const AUTO_QUERY = 'something to cook this weekend';

export default function SearchDemo() {
  const reduced = useReducedMotion();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const touched = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hits = useMemo(() => searchMemories(query), [query]);
  const shown = hits.slice(0, 4);

  // When the demo first scrolls into view, type a query for the visitor.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || reduced) return;
    let timer = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || touched.current) return;
        io.disconnect();
        let i = 0;
        const step = () => {
          if (touched.current) return;
          i++;
          setQuery(AUTO_QUERY.slice(0, i));
          if (i < AUTO_QUERY.length) timer = window.setTimeout(step, 48 + Math.random() * 40);
        };
        timer = window.setTimeout(step, 450);
      },
      { threshold: 0.45 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [reduced]);

  const choose = (value: string) => {
    touched.current = true;
    setQuery(value);
  };

  return (
    <div ref={rootRef} className="lp-search-grid">
      <div className="lp-search-copy">
        <p className="lp-kicker">03 / Live demo</p>
        <h2 className="lp-h2">
          Search like you <em>remember it.</em>
        </h2>
        <p className="lp-lead">
          Vague is fine. Describe the vibe, the topic, roughly when you saved it. File Hug ranks by
          meaning and by words, across your titles, tags, and everything it read inside each link.
        </p>
        <p className="lp-suggest-label" id={`${inputId}-suggest`}>
          Try one:
        </p>
        <ul className="lp-suggest" aria-labelledby={`${inputId}-suggest`}>
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button type="button" className="lp-suggest-chip" aria-pressed={query === s} onClick={() => choose(s)}>
                {s}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <TiltCard className="lp-window" max={4}>
        <div className="lp-window-bar">
          <span className="lp-window-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>Your library · {DEMO_MEMORIES.length} memories</span>
          <span className="lp-window-badge">Demo · runs in your browser</span>
        </div>

        <div className="lp-window-search">
          <label htmlFor={inputId} className="sr-only">
            Search the demo library
          </label>
          <Search size={18} aria-hidden="true" />
          <input
            id={inputId}
            type="search"
            value={query}
            placeholder="Describe what you're looking for…"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => choose(e.target.value)}
          />
          {query ? (
            <button type="button" className="lp-icon-btn" aria-label="Clear search" onClick={() => choose('')}>
              <X size={16} />
            </button>
          ) : (
            <span className="kbd" aria-hidden="true">
              <CornerDownLeft size={12} />
            </span>
          )}
        </div>

        <p className="lp-window-status" aria-live="polite">
          {query.trim()
            ? hits.length
              ? `${hits.length} ${hits.length === 1 ? 'memory matches' : 'memories match'} this thought`
              : 'Nothing yet. Try “recipe”, “funny” or “last week”.'
            : 'Recently saved'}
        </p>

        <ol className="lp-hits">
          {shown.map((hit, i) => (
            <li key={hit.memory.id} className="lp-hit" data-best={query.trim() !== '' && i === 0}>
              <span className="lp-hit-icon">
                <PlatformIcon platform={hit.memory.platform} type={hit.memory.type} className="w-4 h-4" />
              </span>
              <div className="lp-hit-body">
                <p className="lp-hit-title">{hit.memory.title}</p>
                <p className="lp-hit-meta">
                  {hit.memory.kindLabel} · {hit.memory.source} · {agoLabel(hit.memory.daysAgo)}
                </p>
                {hit.snippet && (
                  <p className="lp-hit-snippet">
                    …{hit.snippet.before} <mark>{hit.snippet.match}</mark> {hit.snippet.after}…
                  </p>
                )}
                {hit.reasons.length > 0 && (
                  <p className="lp-hit-reasons">
                    {hit.reasons.slice(0, 3).map((r) => (
                      <span key={r}>{r}</span>
                    ))}
                  </p>
                )}
              </div>
              {query.trim() !== '' && i === 0 && (
                <span className="lp-hit-best">
                  <Sparkles size={12} aria-hidden="true" /> Best match
                </span>
              )}
            </li>
          ))}
        </ol>
      </TiltCard>
    </div>
  );
}
