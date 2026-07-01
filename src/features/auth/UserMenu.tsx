'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from './AuthProvider';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function UserMenu() {
  const { user, isLoading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (isLoading || !user) {
    return <div className="w-7 h-7 rounded-full bg-surface animate-pulse" aria-hidden />;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-surface-hover transition-colors cursor-pointer"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name}
            width={28}
            height={28}
            className="w-7 h-7 rounded-full object-cover border border-border"
          />
        ) : (
          <span className="w-7 h-7 rounded-full bg-primary/15 text-primary-light border border-border-strong flex items-center justify-center text-[11px] font-semibold">
            {initials(user.name)}
          </span>
        )}
        <span className="hidden sm:inline text-sm text-foreground max-w-32 truncate">
          {user.name}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>

      {open && (
        <div
          role="menu"
          className="glass-strong absolute right-0 mt-2 w-52 rounded-xl border border-border p-1.5 shadow-lg z-50"
        >
          <div className="px-3 py-2 border-b border-border/60 mb-1">
            <p className="text-sm text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <Link
            href="/app/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-surface-hover transition-colors"
          >
            <UserIcon className="w-4 h-4 text-muted" />
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-danger hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
