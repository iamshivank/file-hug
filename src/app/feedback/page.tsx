import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Heart } from 'lucide-react';
import { getSession } from '@/features/auth/session';
import FeedbackForm from '@/features/feedback/FeedbackForm';

export const metadata: Metadata = {
  title: 'Feedback — File Hug',
  description: "Tell us what's broken, what you'd love, or what File Hug should do next.",
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const from = (await searchParams).from === 'app' ? 'app' : 'landing';
  const session = await getSession();
  const user = session && !session.user.isDemo ? session.user : null;

  return (
    <div className="min-h-screen bg-background bg-dots flex flex-col">
      <div className="glow-orb w-125 h-125 bg-primary -top-40 left-1/2 -translate-x-1/2 animate-pulse-glow pointer-events-none" />

      <header className="relative z-10 max-w-5xl w-full mx-auto px-6 py-6">
        <Link
          href={from === 'app' ? '/app' : '/'}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {from === 'app' ? 'Back to library' : 'Back to home'}
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-20">
        <div className="glass-strong card w-full max-w-lg p-8">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center mb-4">
              <Heart className="w-5 h-5 text-on-accent fill-on-accent" />
            </div>
            <h1 className="font-display text-2xl text-foreground">Send us feedback</h1>
            <p className="text-sm text-muted-light mt-2 leading-relaxed">
              Found a bug, missing a feature, or just loving it? Every note is read.
            </p>
          </div>

          <FeedbackForm source={from} defaultEmail={user?.email ?? ''} signedIn={!!user} />
        </div>
      </main>
    </div>
  );
}
