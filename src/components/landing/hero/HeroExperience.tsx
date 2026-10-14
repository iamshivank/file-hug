'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Clapperboard,
  Hand,
  Link2,
  MessageSquare,
  Newspaper,
  Play,
  Search,
  Smile,
  Sparkles,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import { useMediaQuery, useReducedMotion, useResolvedTheme } from '../hooks';
import SceneBoundary from './SceneBoundary';
import {
  ALL_KINDS,
  CARD_SPECS,
  COMPACT_KINDS,
  PHASES,
  PHASE_PROGRESS,
  SEARCH_QUERY,
  createHeroStore,
  phaseFor,
  smoothstep,
  type CardKind,
  type HeroStore,
} from './heroStore';

function SceneFallback() {
  return (
    <div className="lp-scene-fallback" aria-hidden="true">
      <span />
      <span />
      <span />
      <i />
    </div>
  );
}

const HeroScene = dynamic(() => import('./HeroScene'), {
  ssr: false,
  loading: () => <SceneFallback />,
});

const CHIP_ICONS: Record<CardKind, LucideIcon> = {
  reel: Clapperboard,
  article: Newspaper,
  chat: MessageSquare,
  meme: Smile,
  link: Link2,
  note: StickyNote,
};

const BASE_VAULT = 128;
const STATS = { words: 3871, transcripts: 2, keywords: 46 };

export default function HeroExperience({ signedIn = false }: { signedIn?: boolean }) {
  const reduced = useReducedMotion();
  const compact = useMediaQuery('(max-width: 760px), (pointer: coarse), (max-aspect-ratio: 1/1)');
  const theme = useResolvedTheme();
  const kinds = compact ? COMPACT_KINDS : ALL_KINDS;

  const store = useRef<HeroStore>(createHeroStore());
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLSpanElement>(null);
  const wordsRef = useRef<HTMLElement>(null);
  const transcriptsRef = useRef<HTMLElement>(null);
  const keywordsRef = useRef<HTMLElement>(null);
  const manualProgress = useRef<number>(PHASE_PROGRESS[0]);

  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [matched, setMatched] = useState(false);
  const [active, setActive] = useState(true);
  const [saved, setSaved] = useState<CardKind[]>([]);
  const [toast, setToast] = useState<{ kind: CardKind; id: number } | null>(null);

  /** Push scroll progress into the scene, the CSS variables, and the counters. */
  const applyProgress = useCallback((p: number) => {
    const st = store.current;
    st.progress = p;
    st.invalidate();

    const stage = stageRef.current;
    if (stage) {
      stage.style.setProperty('--hero-p', p.toFixed(4));
      stage.style.setProperty('--s0', (1 - smoothstep(0.12, 0.24, p)).toFixed(3));
      stage.style.setProperty('--s1', (smoothstep(0.27, 0.36, p) * (1 - smoothstep(0.55, 0.63, p))).toFixed(3));
      stage.style.setProperty('--s2', smoothstep(0.63, 0.71, p).toFixed(3));
    }

    const read = smoothstep(0.28, 0.48, p);
    if (wordsRef.current) wordsRef.current.textContent = Math.round(STATS.words * read).toLocaleString('en-IN');
    if (transcriptsRef.current) transcriptsRef.current.textContent = String(Math.round(STATS.transcripts * read));
    if (keywordsRef.current) keywordsRef.current.textContent = String(Math.round(STATS.keywords * read));

    const typed = Math.round(SEARCH_QUERY.length * Math.min(1, Math.max(0, (p - 0.68) / 0.16)));
    if (queryRef.current) queryRef.current.textContent = SEARCH_QUERY.slice(0, typed);

    setPhase(phaseFor(p));
    setMatched(typed >= SEARCH_QUERY.length);
  }, []);

  // Scroll → progress. Reduced motion pins the hero and uses the phase buttons instead.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (reduced) {
        applyProgress(manualProgress.current);
        return;
      }
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      applyProgress(total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [applyProgress, reduced]);

  // Stop rendering entirely while the hero is off-screen.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { rootMargin: '120px' });
    io.observe(section);
    return () => io.disconnect();
  }, []);

  // Touch: the canvas allows vertical page panning, except while a card is held.
  // R3F's pointerdown runs before touchstart, so `grabbing` is already set here.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const st = store.current;
    st.cursorTarget = stage;
    const block = (e: TouchEvent) => {
      if (st.grabbing) e.preventDefault();
    };
    stage.addEventListener('touchstart', block, { passive: false });
    stage.addEventListener('touchmove', block, { passive: false });
    return () => {
      st.cursorTarget = null;
      stage.removeEventListener('touchstart', block);
      stage.removeEventListener('touchmove', block);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(id);
  }, [toast]);

  const onSaved = useCallback((kind: CardKind) => {
    setSaved((prev) => (prev.includes(kind) ? prev : [...prev, kind]));
    setToast({ kind, id: Date.now() });
  }, []);

  const focusCard = (index: number) => {
    store.current.focus = index;
    store.current.invalidate();
  };

  const saveCard = (index: number) => {
    store.current.absorbQueue.push(index);
    store.current.invalidate();
  };

  const goToPhase = (i: 0 | 1 | 2) => {
    if (reduced) {
      manualProgress.current = PHASE_PROGRESS[i];
      applyProgress(PHASE_PROGRESS[i]);
      return;
    }
    const section = sectionRef.current;
    if (!section) return;
    const total = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + total * PHASE_PROGRESS[i], behavior: 'smooth' });
  };

  const toastSpec = toast ? CARD_SPECS[toast.kind] : null;

  return (
    <section ref={sectionRef} className="lp-hero" aria-labelledby="lp-hero-title">
      <div ref={stageRef} className="lp-hero-stage" data-phase={phase}>
        <div className="lp-hero-canvas" aria-hidden="true">
          <SceneBoundary fallback={<SceneFallback />}>
            <HeroScene
              storeRef={store}
              kinds={kinds}
              quality={compact ? 'low' : 'high'}
              theme={theme}
              reduced={reduced}
              active={active}
              onSaved={onSaved}
            />
          </SceneBoundary>
        </div>
        <div className="lp-hero-shade" aria-hidden="true" />

        <div className="lp-hero-copy">
          <div className="lp-hero-panel" data-stage="0" inert={phase !== 0}>
            <p className="lp-eyebrow">
              <span className="lp-live-dot" aria-hidden="true" /> Your AI memory for the internet
            </p>
            <h1 id="lp-hero-title" className="lp-hero-title">
              Never lose something you <em>wanted to remember.</em>
            </h1>
            <p className="lp-hero-deck">
              Save reels, articles, ChatGPT chats, memes, links and notes in one place. File Hug opens
              and reads every link, then finds it again when you describe it in your own words.
            </p>
            <div className="lp-hero-actions">
              {signedIn ? (
                <Link href="/app" className="lp-btn lp-btn-primary">
                  Open your library <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="lp-btn lp-btn-primary">
                    Start free <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  <a href="/api/auth/demo" className="lp-btn lp-btn-ghost">
                    <Play size={15} aria-hidden="true" /> Try the live demo
                  </a>
                </>
              )}
            </div>
            <p className="lp-hint">
              <Hand size={15} aria-hidden="true" />
              <span>Drag the cards. Throw one into the vault, or tap it to save.</span>
            </p>
          </div>

          <div className="lp-hero-panel" data-stage="1" inert={phase !== 1}>
            <p className="lp-eyebrow">02 / Index</p>
            <h2 className="lp-hero-title lp-hero-title-sm">
              We open every link and <em>actually read it.</em>
            </h2>
            <p className="lp-hero-deck">
              Page text, video transcripts, titles and keywords, embedded for meaning and indexed for
              words. You never have to tag a thing.
            </p>
            <dl className="lp-stats">
              <div>
                <dt>Words read</dt>
                <dd ref={wordsRef}>0</dd>
              </div>
              <div>
                <dt>Transcripts</dt>
                <dd ref={transcriptsRef}>0</dd>
              </div>
              <div>
                <dt>Keywords</dt>
                <dd ref={keywordsRef}>0</dd>
              </div>
            </dl>
          </div>

          <div className="lp-hero-panel" data-stage="2" inert={phase !== 2}>
            <p className="lp-eyebrow">03 / Recall</p>
            <h2 className="lp-hero-title lp-hero-title-sm">
              Ask the way <em>you remember it.</em>
            </h2>
            <div className="lp-searchbar" role="img" aria-label={`Search: ${SEARCH_QUERY}`}>
              <Search size={18} aria-hidden="true" />
              <span ref={queryRef} className="lp-searchbar-text" />
              <span className="lp-caret" aria-hidden="true" />
            </div>
            <div className="lp-result" data-show={matched}>
              <Sparkles size={16} aria-hidden="true" />
              <div>
                <p className="lp-result-title">72-hour sourdough, the lazy way</p>
                <p className="lp-result-meta">Reel · @wildyeast.co · saved 3 weeks ago</p>
                <p className="lp-result-why">
                  Matched in transcript: <mark>“…cold proof it in the fridge for 72 hours…”</mark>
                </p>
              </div>
            </div>
            <Link href={signedIn ? '/app' : '/login'} className="lp-btn lp-btn-primary lp-recall-cta">
              {signedIn ? 'Search your memory' : 'Build your memory'} <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="lp-hero-dock">
          <div className="lp-phase-rail" role="group" aria-label="Hero story">
            {PHASES.map((ph, i) => (
              <button
                key={ph.id}
                type="button"
                className="lp-phase"
                data-i={i}
                aria-current={phase === i ? 'step' : undefined}
                onClick={() => goToPhase(i as 0 | 1 | 2)}
              >
                <span className="lp-phase-label">
                  <b>0{i + 1}</b> {ph.label}
                </span>
                <span className="lp-phase-bar" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="lp-chip-dock" inert={phase !== 0}>
            <span className="lp-chip-dock-label">Save one:</span>
            <ul className="lp-chip-row">
              {kinds.map((kind, i) => {
                const Icon = CHIP_ICONS[kind];
                const isSaved = saved.includes(kind);
                const spec = CARD_SPECS[kind];
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      className="lp-chip"
                      data-saved={isSaved}
                      aria-label={`Save the ${spec.label.toLowerCase()} into your vault`}
                      onPointerEnter={() => focusCard(i)}
                      onPointerLeave={() => focusCard(-1)}
                      onFocus={() => focusCard(i)}
                      onBlur={() => focusCard(-1)}
                      onClick={() => saveCard(i)}
                    >
                      {isSaved ? <Check size={14} aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}
                      {spec.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="lp-vault-count">
            <span className="lp-live-dot" aria-hidden="true" />
            Vault · <b>{BASE_VAULT + saved.length}</b> memories
          </p>
        </div>

        <div className="lp-toast-region" role="status" aria-live="polite">
          {toast && toastSpec && (
            <div key={toast.id} className="lp-toast">
              <span className="lp-toast-icon">
                <Check size={14} aria-hidden="true" />
              </span>
              <span>
                <b>{toastSpec.label} saved</b> from {toastSpec.source}
                <small>Indexed {toastSpec.indexed}</small>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
