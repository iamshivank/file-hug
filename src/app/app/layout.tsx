import Link from 'next/link';
import { Heart, ArrowLeft } from 'lucide-react';

const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="glass-strong sticky top-0 z-50 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-3.5 h-3.5 text-background fill-background" />
            </div>
            <span className="font-display text-lg text-foreground">File Hug</span>
            {IS_DEMO && (
              <span className="text-[11px] px-2 py-0.5 bg-primary/15 text-primary-light rounded-full font-medium border border-border-strong">
                Demo
              </span>
            )}
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to site
          </Link>
        </div>
      </header>

      <main className="bg-dots min-h-[calc(100vh-3.5rem)]">{children}</main>
    </div>
  );
}
