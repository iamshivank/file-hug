'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. */
  max?: number;
}

/**
 * A surface that leans toward the cursor with a moving specular glare.
 * Children opt into parallax depth with `.lp-depth-1` / `.lp-depth-2`.
 * Mouse/pen only; touch and reduced-motion get a flat card (see globals.css).
 */
export default function TiltCard({ children, className = '', max = 9 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty('--tilt-x', `${((0.5 - y) * max).toFixed(2)}deg`);
      el.style.setProperty('--tilt-y', `${((x - 0.5) * max).toFixed(2)}deg`);
      el.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
      el.dataset.tilting = 'true';
    });
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    delete el.dataset.tilting;
  };

  return (
    <div ref={ref} className={`lp-tilt ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </div>
  );
}
