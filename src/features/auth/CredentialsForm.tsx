'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

type Mode = 'signin' | 'signup';
type Status = 'idle' | 'loading' | 'error';

export default function CredentialsForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    setStatus('idle');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setError('');

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        mode === 'signup' ? { name, email, password } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setStatus('error');
        setError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push('/app');
      router.refresh();
    } catch {
      setStatus('error');
      setError('Network error. Please try again.');
    }
  };

  const inputClasses =
    'w-full px-4 py-2.5 bg-surface border border-border-strong rounded-xl text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary transition-colors';

  return (
    <form onSubmit={handleSubmit} className="text-left">
      {mode === 'signup' && (
        <div className="mb-3">
          <label htmlFor="cred-name" className="sr-only">
            Name
          </label>
          <input
            id="cred-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            maxLength={200}
            autoComplete="name"
            className={inputClasses}
          />
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="cred-email" className="sr-only">
          Email
        </label>
        <input
          id="cred-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className={inputClasses}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="cred-password" className="sr-only">
          Password
        </label>
        <input
          id="cred-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'signup' ? 'Password (min 8 characters)' : 'Password'}
          required
          minLength={8}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className={inputClasses}
        />
      </div>

      {status === 'error' && (
        <p role="alert" className="text-xs text-red-400 mb-3 leading-relaxed">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex w-full items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 disabled:opacity-60 rounded-xl text-on-accent font-medium transition-colors"
      >
        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>

      <p className="text-xs text-muted mt-4 text-center">
        {mode === 'signin' ? (
          <>
            New to File Hug?{' '}
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className="text-primary hover:underline font-medium"
            >
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </form>
  );
}
