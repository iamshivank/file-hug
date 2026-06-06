'use client';

import { Link2, FileText } from 'lucide-react';

interface PlatformIconProps {
  platform: string | null;
  type: 'url' | 'note';
  className?: string;
}

export default function PlatformIcon({ platform, type, className = 'w-4 h-4' }: PlatformIconProps) {
  if (type === 'note') return <FileText className={className} />;

  const base = { 'aria-hidden': true as const, className };

  switch (platform) {
    case 'instagram':
      return (
        <svg {...base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'youtube':
      return (
        <svg {...base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <polygon fill="currentColor" stroke="none" points="10,9 16,12 10,15" />
        </svg>
      );
    case 'X':
      return (
        <svg {...base} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-7.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg {...base} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.54V6.77a4.85 4.85 0 0 1-1.06-.08z" />
        </svg>
      );
    case 'reddit':
      return (
        <svg {...base} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="8.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
          <path d="M8.5 17 Q12 19.5 15.5 17" />
          <path d="M12 8 L14.5 4.5" />
          <circle cx="15" cy="3.8" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'github':
      return (
        <svg {...base} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
      );
    case 'medium':
      return (
        <svg {...base} viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.846 6.887c.03-.295-.083-.586-.303-.784L.303 3.62V3.22H7.26l5.378 11.795 4.728-11.795H24v.4l-1.916 1.837c-.165.126-.247.333-.213.538v13.498c-.034.204.048.411.213.537L23.76 21.8v.4H14.35v-.4l1.937-1.882c.19-.19.19-.246.19-.537V8.395L11.547 22.2h-.727L4.508 8.395v9.256c-.052.385.076.772.347 1.05L7.375 21.8v.4H0v-.4l2.52-3.1c.27-.278.39-.67.33-1.05L2.846 6.887z" />
        </svg>
      );
    default:
      return <Link2 className={className} />;
  }
}
