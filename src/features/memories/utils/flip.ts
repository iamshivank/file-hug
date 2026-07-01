/**
 * Shared-element "flip open" animation.
 *
 * Given the on-screen rect of the clicked card (`originRect`) and the popup's
 * own element (already at its resting position/size), this animates the popup
 * FROM the card's position — translated + scaled to overlap it, with a 3D
 * `rotateX` hinge — TO its resting spot. The entrance is decelerating
 * (ease-out overshoot); no ease-in on the way open.
 *
 * Uses the Web Animations API so the start transform is computed precisely from
 * the measured rects rather than guessed. Falls back to a quick fade when the
 * origin is unknown or the user prefers reduced motion.
 */

/** Overshoot bezier that still reads as ease-out (decelerating entrance). */
const FLIP_EASING = 'cubic-bezier(0.2, 0.9, 0.3, 1.15)';
const FLIP_DURATION = 460;
const FADE_DURATION = 220;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

interface FlipOptions {
  /** 3D hinge origin, e.g. 'center top' (modal) or 'top left' (PiP). */
  transformOrigin?: string;
  /** Tilt of the opening flip in degrees. */
  rotateDeg?: number;
}

/**
 * Plays the flip-open animation on `el`. Safe to call in an effect after mount.
 * When `originRect` is null/undefined, plays a simple fade instead.
 */
export function playFlipOpen(
  el: HTMLElement,
  originRect: DOMRect | null | undefined,
  { transformOrigin = 'center top', rotateDeg = 28 }: FlipOptions = {},
): void {
  if (typeof el.animate !== 'function') return;

  // Reduced motion or unknown origin: a short, gentle fade (still ease-out).
  if (prefersReducedMotion() || !originRect) {
    el.animate(
      [
        { opacity: 0, transform: 'scale(0.98)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: FADE_DURATION, easing: 'ease-out', fill: 'both' },
    );
    return;
  }

  const dest = el.getBoundingClientRect();
  if (dest.width === 0 || dest.height === 0) return;

  // Scale so the popup starts roughly the size of the card, and translate so
  // its top-left begins at the card's top-left. Both transforms are relative to
  // the element's own transform-origin, set via `transformOrigin` on the node.
  const scale = Math.max(0.1, originRect.width / dest.width);
  const dx = originRect.left - dest.left;
  const dy = originRect.top - dest.top;

  el.style.transformOrigin = transformOrigin;

  el.animate(
    [
      {
        opacity: 0.55,
        transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotateX(-${rotateDeg}deg)`,
      },
      { opacity: 1, offset: 0.5 },
      {
        opacity: 1,
        transform: 'translate(0px, 0px) scale(1) rotateX(0deg)',
      },
    ],
    { duration: FLIP_DURATION, easing: FLIP_EASING, fill: 'both' },
  );
}
