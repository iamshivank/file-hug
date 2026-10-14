'use client';

import { useState } from 'react';
import { Bug, CheckCircle2, Heart, Lightbulb, Loader2, MessageCircle, Star } from 'lucide-react';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_MIN_LENGTH, type FeedbackKind } from './constants';

type Status = 'idle' | 'loading' | 'success' | 'error';

const KINDS: { key: FeedbackKind; label: string; Icon: typeof Bug }[] = [
  { key: 'bug', label: 'Bug', Icon: Bug },
  { key: 'idea', label: 'Idea', Icon: Lightbulb },
  { key: 'praise', label: 'Praise', Icon: Heart },
  { key: 'other', label: 'Other', Icon: MessageCircle },
];

const PLACEHOLDERS: Record<FeedbackKind, string> = {
  bug: 'What happened, and what did you expect?',
  idea: 'What should File Hug do?',
  praise: 'What do you love?',
  other: 'Tell us anything…',
};

const RATING_LABELS = ['Poor', 'Meh', 'Okay', 'Good', 'Love it'];

interface FeedbackFormProps {
  source: 'landing' | 'app';
  /** The page the user came from, e.g. `/app/profile`. */
  page: string | null;
  defaultEmail: string;
  signedIn: boolean;
}

/** What the user was looking at — sent with the report so bugs can be reproduced. */
function clientContext() {
  const explicit = document.documentElement.getAttribute('data-theme');
  const theme =
    explicit === 'light' || explicit === 'dark'
      ? explicit
      : window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Older browsers — leave it out.
  }
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    locale: navigator.language,
    timezone,
    theme,
  };
}

export default function FeedbackForm({ source, page, defaultEmail, signedIn }: FeedbackFormProps) {
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < FEEDBACK_MIN_LENGTH) {
      setStatus('error');
      setError('Please tell us a little more.');
      return;
    }
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, rating, message, email, source, page, website, ...clientContext() }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        setStatus('error');
        setError(json.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setStatus('success');
    } catch {
      setStatus('error');
      setError('Network error. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center text-center py-6" role="status">
        <CheckCircle2 className="w-10 h-10 text-success mb-3" />
        <p className="font-display text-xl text-foreground">Thank you!</p>
        <p className="text-sm text-muted-light mt-1.5">
          Your feedback is in.{email ? ' We may reply by email.' : ''}
        </p>
        <button
          type="button"
          onClick={() => {
            setMessage('');
            setRating(null);
            setStatus('idle');
          }}
          className="mt-5 text-sm text-primary-light hover:underline cursor-pointer"
        >
          Send more
        </button>
      </div>
    );
  }

  const inputClasses =
    'w-full px-4 py-3 bg-background border border-border-strong rounded-xl text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <fieldset>
        <legend className="text-xs font-medium text-muted-light mb-2">What kind of feedback?</legend>
        <div className="grid grid-cols-4 gap-2">
          {KINDS.map(({ key, label, Icon }) => (
            <label
              key={key}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium cursor-pointer transition-colors has-focus-visible:ring-2 has-focus-visible:ring-primary/40 ${
                kind === key
                  ? 'bg-primary/15 text-primary-light border-border-strong'
                  : 'bg-surface text-muted hover:text-foreground border-border'
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={key}
                checked={kind === key}
                onChange={() => setKind(key)}
                className="sr-only"
              />
              <Icon className="w-4 h-4" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-xs font-medium text-muted-light mb-2">
          How&apos;s File Hug working for you? <span className="text-muted">(optional)</span>
        </legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
          {RATING_LABELS.map((label, i) => {
            const value = i + 1;
            const lit = (hover ?? rating ?? 0) >= value;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setRating(rating === value ? null : value)}
                onMouseEnter={() => setHover(value)}
                aria-label={`${value} of 5 — ${label}`}
                aria-pressed={rating === value}
                className="p-1 rounded-lg cursor-pointer hover:bg-surface-hover transition-colors"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${lit ? 'text-primary fill-primary' : 'text-muted'}`}
                />
              </button>
            );
          })}
          <span className="ml-2 text-xs text-muted min-w-14">
            {RATING_LABELS[(hover ?? rating ?? 0) - 1] ?? ''}
          </span>
        </div>
      </fieldset>

      <div>
        <label htmlFor="feedback-message" className="block text-xs font-medium text-muted-light mb-2">
          Your message
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={FEEDBACK_MAX_LENGTH}
          required
          placeholder={PLACEHOLDERS[kind]}
          className={`${inputClasses} resize-y min-h-32`}
        />
        <p className="text-[11px] text-muted text-right mt-1 tabular-nums">
          {message.length.toLocaleString()} / {FEEDBACK_MAX_LENGTH.toLocaleString()}
        </p>
      </div>

      <div>
        <label htmlFor="feedback-email" className="block text-xs font-medium text-muted-light mb-2">
          Email{' '}
          {!signedIn && <span className="text-muted">(optional, if you&apos;d like a reply)</span>}
        </label>
        <input
          id="feedback-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={inputClasses}
        />
      </div>

      {/* Honeypot — hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="feedback-website">Website</label>
        <input
          id="feedback-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {status === 'error' && error && <p className="text-danger text-sm">{error}</p>}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex w-full items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary-light disabled:opacity-60 rounded-xl text-on-accent font-semibold transition-colors cursor-pointer"
      >
        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
        Send feedback
      </button>
    </form>
  );
}
