'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SessionUser } from './session';

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  /** Optional server-provided user so the header renders without a flash. */
  initialUser?: SessionUser | null;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(initialUser === null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/auth/session');
        const json = (await res.json()) as { user: SessionUser | null };
        if (!cancelled) setUser(json.user ?? null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
