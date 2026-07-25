import { ImageResponse } from 'next/og';
import { BRAND_HEART_PATH, BRAND_ON_ACCENT, BRAND_PRIMARY } from '@/constants/brand';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * iOS home-screen icon. Full-bleed with no corner radius — iOS applies its own
 * rounded mask, so baking one in would double up.
 */
export default function AppleIcon() {
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
        }}
      >
        <svg
          width={104}
          height={104}
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
