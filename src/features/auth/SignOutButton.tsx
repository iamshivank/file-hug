'use client';

import { useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from './AuthProvider';

/** Sign this browser out. Other devices stay signed in (see Active devices). */
export default function SignOutButton({ className = '' }: { className?: string }) {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setPending(true);
        void signOut();
      }}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-strong text-sm text-danger hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
      Sign out
    </button>
  );
}
