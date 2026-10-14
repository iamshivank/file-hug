'use client';

import { useEffect } from 'react';

/**
 * The server already redirects signed-in visitors away from /login, but the
 * browser's back/forward cache can restore the page without asking the server.
 * When that happens (`pageshow` with `persisted`), re-check the session and
 * bounce a signed-in user back into the app instead of showing the form.
 */
export default function SignedInRedirect({ to }: { to: string }) {
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        const json = (await res.json()) as { user: { isDemo: boolean } | null };
        if (json.user && !json.user.isDemo) window.location.replace(to);
      } catch {
        // Offline or similar — leave the form usable.
      }
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void check();
    }

    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [to]);

  return null;
}
