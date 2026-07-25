import { ImageResponse } from 'next/og';
import { BRAND_HEART_PATH, BRAND_ON_ACCENT, BRAND_PRIMARY } from '@/constants/brand';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * Browser tab favicon. The heart is scaled to ~66% of the canvas (rather than
 * the ~44% the on-page mark uses) so it stays legible when the tab renders it
 * at 16x16.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND_PRIMARY,
          borderRadius: 8,
        }}
      >
        <svg
          width={21}
          height={21}
          viewBox="0 0 24 24"
          fill={BRAND_ON_ACCENT}
          stroke={BRAND_ON_ACCENT}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={BRAND_HEART_PATH} />
        </svg>
      </div>
    ),
    { ...size }
  );
}
