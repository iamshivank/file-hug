'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut, Monitor, ShieldCheck, Smartphone } from 'lucide-react';

interface DeviceSession {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

type LoadStatus = 'loading' | 'ready' | 'error';

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 300) return 'Active now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Active ${days}d ago`;
}

const MOBILE = /iPhone|iPad|Android/;

export default function ActiveSessions() {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/sessions', { cache: 'no-store' });
      const json = (await res.json()) as { success: boolean; data?: DeviceSession[]; error?: string };
      if (!res.ok || !json.success || !json.data) {
        setError(json.error ?? 'Could not load your devices.');
        setStatus('error');
        return;
      }
      setSessions(json.data);
      setError('');
      setStatus('ready');
    } catch {
      setError('Could not load your devices.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: state is only set once the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const revoke = async (body: { id: string } | { scope: 'others' }, key: string) => {
    setBusyId(key);
    setError('');
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success: boolean; data?: { signedOut?: boolean }; error?: string };
      if (json.data?.signedOut) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok || !json.success) setError(json.error ?? 'Could not sign that device out.');
      await load();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const others = sessions.filter((s) => !s.current);

  return (
    <section className="card p-6 sm:p-8 mt-6">
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <p className="text-primary-light text-xs font-semibold uppercase tracking-[0.2em] mb-2">
            Security
          </p>
          <h2 className="font-display text-2xl text-foreground">Active devices</h2>
          <p className="text-muted-light text-sm mt-1">
            Everywhere you&apos;re signed in. Sign out anything you don&apos;t recognise.
          </p>
        </div>
        {others.length > 0 && (
          <button
            type="button"
            onClick={() => revoke({ scope: 'others' }, 'others')}
            disabled={busyId !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-strong text-sm text-danger hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busyId === 'others' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            Sign out all other devices
          </button>
        )}
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}

      {status === 'loading' ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : status === 'ready' && sessions.length === 0 ? (
        <p className="text-muted text-sm">
          This device will appear here the next time your sign-in refreshes.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {sessions.map((s) => {
            const Icon = MOBILE.test(s.device) ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex items-center gap-4 py-3.5">
                <span className="w-10 h-10 rounded-xl bg-primary/10 border border-border flex items-center justify-center shrink-0 text-primary-light">
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground flex items-center gap-2 flex-wrap">
                    {s.device}
                    {s.current && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-primary/15 text-primary-light rounded-full font-medium border border-border-strong">
                        <ShieldCheck className="w-3 h-3" />
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {relativeTime(s.lastSeenAt)} · Signed in {new Date(s.createdAt).toLocaleDateString()}
                    {s.ip ? ` · ${s.ip}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke({ id: s.id }, s.id)}
                  disabled={busyId !== null}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-sm text-muted hover:text-danger hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busyId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign out'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
