import Link from 'next/link';
import { Heart, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Sign in — File Hug',
  description: 'Sign in to File Hug to save links and notes and find them later.',
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.582c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.582 9 3.582z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background bg-dots flex flex-col">
      {/* Warm ambient glow */}
      <div className="glow-orb w-125 h-125 bg-primary -top-40 left-1/2 -translate-x-1/2 animate-pulse-glow pointer-events-none" />

      <header className="relative z-10 max-w-5xl w-full mx-auto px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 pb-20">
        <div className="glass-strong card w-full max-w-sm p-8 text-center">
          <div className="flex flex-col items-center mb-7">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center mb-4">
              <Heart className="w-5 h-5 text-background fill-background" />
            </div>
            <h1 className="font-display text-2xl text-foreground">Welcome to File Hug</h1>
            <p className="text-sm text-muted-light mt-2 leading-relaxed">
              Save links &amp; notes, then find them later.
            </p>
          </div>

          <a
            href="/api/auth/google"
            className="group inline-flex w-full items-center justify-center gap-3 px-5 py-3 bg-surface hover:bg-surface-hover border border-border-strong rounded-xl text-foreground font-medium transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </a>

          <p className="text-xs text-muted mt-5 leading-relaxed">
            Google sign-in works when configured — otherwise you&apos;ll continue as a demo
            account.
          </p>
        </div>
      </main>
    </div>
  );
}
