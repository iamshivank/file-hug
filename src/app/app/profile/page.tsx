import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';

import { getSession } from '@/features/auth/session';
import { getUserPlan } from '@/features/billing/subscription';
import { PLANS } from '@/features/billing/plans';
import UpgradeOptions from './UpgradeOptions';

export const metadata: Metadata = {
  title: 'File Hug — Your Profile',
  description: 'Manage your account and plan.',
};

/** Derive up-to-two-letter initials from a display name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const { user } = session;
  const planId = await getUserPlan(user.id);
  const plan = PLANS[planId];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Back link */}
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to library
      </Link>

      {/* Header */}
      <header className="flex items-center gap-4 mb-10">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name}
            className="w-16 h-16 rounded-full object-cover border border-border-strong"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/15 border border-border-strong flex items-center justify-center">
            <span className="font-display text-xl text-primary-light">{initials(user.name)}</span>
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-2xl sm:text-3xl text-foreground truncate">
              {user.name}
            </h1>
            {user.isDemo && (
              <span className="text-[11px] px-2 py-0.5 bg-primary/15 text-primary-light rounded-full font-medium border border-border-strong">
                Demo account
              </span>
            )}
          </div>
          <p className="text-muted-light text-sm mt-0.5 truncate">{user.email}</p>
        </div>
      </header>

      {/* Your plan */}
      <section className="card p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-primary-light text-xs font-semibold uppercase tracking-[0.2em] mb-2">
              Your plan
            </p>
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-2xl text-foreground">{plan.name}</h2>
              {plan.highlight && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary-light text-[11px] font-medium border border-border-strong">
                  <Sparkles className="w-3 h-3" />
                  Popular
                </span>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            {plan.priceInr === 0 ? (
              <p className="font-display text-lg text-foreground">Free forever</p>
            ) : (
              <p className="flex items-baseline gap-1 justify-end">
                <span className="font-display text-2xl text-foreground">₹{plan.priceInr}</span>
                <span className="text-muted text-sm">/{plan.period}</span>
              </p>
            )}
          </div>
        </div>

        <p className="text-muted-light text-sm mb-5">{plan.tagline}</p>

        {/* What's included */}
        <ul className="space-y-3 mb-2">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 border border-border flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-primary-light" />
              </span>
              <span className="text-muted-light text-sm leading-relaxed">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Free-plan usage hint */}
        {planId === 'free' && (
          <div className="mt-5 rounded-xl border border-border bg-background-elev px-4 py-3">
            <p className="text-sm text-muted-light">
              You&apos;re on the free plan with up to{' '}
              <span className="text-foreground font-medium">
                {(plan.linkLimit ?? 1000).toLocaleString()} links
              </span>
              . Upgrade for a higher limit, faster indexed search, and AI-powered recall.
            </p>
          </div>
        )}

        {/* Upgrade options (client — Razorpay checkout) */}
        <Suspense fallback={null}>
          <UpgradeOptions currentPlan={planId} userName={user.name} userEmail={user.email} />
        </Suspense>
      </section>
    </div>
  );
}
