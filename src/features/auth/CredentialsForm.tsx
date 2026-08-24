'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

type Mode = 'signin' | 'signup';
type Status = 'idle' | 'loading' | 'error';

export default function CredentialsForm({ plan }: { plan?: 'pro' | 'ai' | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    setStatus('idle');
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setError('');

    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload = mode === 'signup' ? { name, email, password } : { email, password };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setStatus('error');
        setError(result.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push(plan ? `/app/profile?plan=${plan}` : '/app');
      router.refresh();
    } catch {
      setStatus('error');
      setError('Network error. Please try again.');
    }
  };

  const inputClasses =
    'w-full px-4 py-3 bg-background border border-border-strong rounded-xl text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="text-left">
      {mode === 'signup' && (
        <div className="mb-3">
          <label htmlFor="cred-name" className="sr-only">Name</label>
          <input
            id="cred-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            required
            maxLength={200}
            autoComplete="name"
            className={inputClasses}
          />
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="cred-email" className="sr-only">Email</label>
        <input
          id="cred-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className={inputClasses}
        />
      </div>

      <div className="relative mb-4">
        <label htmlFor="cred-password" className="sr-only">Password</label>
        <input
          id="cred-password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={mode === 'signup' ? 'Password (minimum 8 characters)' : 'Password'}
          required
          minLength={8}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className={`${inputClasses} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {status === 'error' && (
        <p role="alert" className="text-xs text-danger mb-3 leading-relaxed">{error}</p>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex w-full items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-light disabled:opacity-60 rounded-xl text-on-accent font-semibold transition-colors cursor-pointer"
      >
        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </button>

      <p className="text-xs text-muted mt-4 text-center">
        {mode === 'signin' ? (
          <>New to File Hug?{' '}<button type="button" onClick={() => switchMode('signup')} className="text-primary-light hover:underline font-medium cursor-pointer">Create an account</button></>
        ) : (
          <>Already have an account?{' '}<button type="button" onClick={() => switchMode('signin')} className="text-primary-light hover:underline font-medium cursor-pointer">Sign in</button></>
        )}
      </p>
    </form>
  );
}
