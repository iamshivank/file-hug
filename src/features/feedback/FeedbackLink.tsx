'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Link to /feedback that remembers which page it was clicked on. */
export default function FeedbackLink({
  from,
  className,
  children,
}: {
  from: 'landing' | 'app';
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const href = `/feedback?from=${from}&page=${encodeURIComponent(pathname || '/')}`;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
