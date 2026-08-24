'use client';

import dynamic from 'next/dynamic';

const MemoryScene = dynamic(() => import('./MemoryScene'), {
  ssr: false,
  loading: () => <div className="landing-scene landing-scene-fallback" aria-hidden="true" />,
});

export default function LandingScene() {
  return <MemoryScene />;
}
