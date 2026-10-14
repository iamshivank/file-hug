'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import PlatformIcon from '@/features/memories/components/PlatformIcon';
import { useReducedMotion } from './hooks';

const ITEMS: { platform: string | null; type: 'url' | 'note'; label: string; note: string }[] = [
  { platform: 'instagram', type: 'url', label: 'Instagram', note: 'Reels, posts and carousels' },
  { platform: 'youtube', type: 'url', label: 'YouTube', note: 'Videos and Shorts, transcripts included' },
  { platform: 'X', type: 'url', label: 'X', note: 'Posts and long threads' },
  { platform: 'chatgpt', type: 'url', label: 'ChatGPT', note: 'Shared conversations' },
  { platform: 'reddit', type: 'url', label: 'Reddit', note: 'Threads worth coming back to' },
  { platform: 'github', type: 'url', label: 'GitHub', note: 'Repos, with their READMEs read' },
  { platform: 'tiktok', type: 'url', label: 'TikTok', note: 'Recipes, tips and rabbit holes' },
  { platform: 'medium', type: 'url', label: 'Medium', note: 'Articles, read in full' },
  { platform: 'spotify', type: 'url', label: 'Spotify', note: 'Episodes and playlists' },
  { platform: 'linkedin', type: 'url', label: 'LinkedIn', note: 'Posts you meant to reread' },
  { platform: 'claude', type: 'url', label: 'Claude', note: 'Shared chats' },
  { platform: null, type: 'note', label: 'Notes', note: 'Your own half-formed thoughts' },
];

const STEP = 360 / ITEMS.length;

interface OrbitSim {
  angle: number;
  vel: number;
  target: number | null;
  dragging: boolean;
  hover: boolean;
  lastX: number;
  lastT: number;
}

/** A 3D carousel you can grab and fling. Arrow keys and the buttons step it. */
export default function PlatformOrbit() {
  const reduced = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const sim = useRef<OrbitSim>({ angle: 0, vel: 0, target: null, dragging: false, hover: false, lastX: 0, lastT: 0 });
  const kick = useRef<() => void>(() => {});
  const [front, setFront] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const ring = ringRef.current;
    if (!wrap || !ring) return;
    let raf = 0;
    let last = 0;
    let visible = false;
    const n = ITEMS.length;

    itemRefs.current.forEach((el, i) => el?.style.setProperty('--orbit-angle', `${i * STEP}deg`));

    const apply = () => {
      const s = sim.current;
      ring.style.setProperty('--orbit-rot', `${s.angle.toFixed(2)}deg`);
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const a = ((i * STEP + s.angle) * Math.PI) / 180;
        el.style.setProperty('--depth', ((Math.cos(a) + 1) / 2).toFixed(3));
      });
      setFront((((Math.round(-s.angle / STEP) % n) + n) % n));
    };

    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const s = sim.current;
      let busy = s.dragging;
      if (!s.dragging) {
        if (s.target !== null) {
          const d = s.target - s.angle;
          s.angle += d * (reduced ? 1 : 1 - Math.exp(-9 * dt));
          if (Math.abs(d) < 0.05) {
            s.angle = s.target;
            s.target = null;
          }
          busy = true;
        } else if (Math.abs(s.vel) > 1 && !reduced) {
          s.angle += s.vel * dt;
          s.vel *= Math.exp(-2.4 * dt);
          busy = true;
        } else if (!reduced && !s.hover) {
          s.vel = 0;
          s.angle -= 7 * dt;
          busy = true;
        }
      }
      apply();
      raf = visible && busy ? requestAnimationFrame(tick) : 0;
    };

    kick.current = () => {
      if (!raf && visible) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) kick.current();
    });
    io.observe(wrap);
    // One frame so the ring is laid out even before it scrolls into view.
    raf = requestAnimationFrame(tick);

    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      kick.current = () => {};
    };
  }, [reduced]);

  const stepBy = (dir: 1 | -1) => {
    const s = sim.current;
    const base = s.target ?? Math.round(s.angle / STEP) * STEP;
    s.target = base - dir * STEP;
    s.vel = 0;
    kick.current();
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const s = sim.current;
    s.dragging = true;
    s.target = null;
    s.vel = 0;
    s.lastX = e.clientX;
    s.lastT = performance.now();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset.dragging = 'true';
    kick.current();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (!s.dragging) return;
    const now = performance.now();
    const dx = (e.clientX - s.lastX) * 0.32;
    const secs = Math.max(0.008, (now - s.lastT) / 1000);
    s.angle += dx;
    s.vel = s.vel * 0.4 + (dx / secs) * 0.6;
    s.lastX = e.clientX;
    s.lastT = now;
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (!s.dragging) return;
    s.dragging = false;
    if (performance.now() - s.lastT > 80) s.vel = 0;
    s.vel = Math.max(-900, Math.min(900, s.vel));
    delete e.currentTarget.dataset.dragging;
    kick.current();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepBy(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepBy(1);
    }
  };

  const current = ITEMS[front];

  return (
    <div className="lp-orbit-block">
      <div
        ref={wrapRef}
        className="lp-orbit"
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="Platforms File Hug saves from. Drag, or use the left and right arrow keys, to rotate."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={() => {
          sim.current.hover = true;
        }}
        onPointerLeave={() => {
          sim.current.hover = false;
          kick.current();
        }}
        onKeyDown={onKeyDown}
      >
        <div className="lp-orbit-core" aria-hidden="true">
          <Heart size={30} strokeWidth={2.2} />
        </div>
        <div ref={ringRef} className="lp-orbit-ring">
          <ul className="lp-orbit-list">
            {ITEMS.map((item, i) => (
              <li
                key={item.label}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="lp-orbit-item"
                data-front={i === front}
              >
                <span className="lp-orbit-tile">
                  <PlatformIcon platform={item.platform} type={item.type} className="w-6 h-6" />
                  <span>{item.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lp-orbit-floor" aria-hidden="true" />
      </div>

      <div className="lp-orbit-caption">
        <button type="button" className="lp-icon-btn lp-icon-btn-lg" aria-label="Previous platform" onClick={() => stepBy(-1)}>
          <ChevronLeft size={18} />
        </button>
        <p>
          <b>{current.label}</b>
          <span>{current.note}</span>
        </p>
        <button type="button" className="lp-icon-btn lp-icon-btn-lg" aria-label="Next platform" onClick={() => stepBy(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
