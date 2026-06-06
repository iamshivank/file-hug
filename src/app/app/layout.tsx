import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';

const IS_DEMO = process.env.NEXT_PUBLIC_IS_DEMO_MODE === 'true';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="glass-strong sticky top-0 z-50 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary-light" />
            <span className="font-semibold text-foreground">File Hug</span>
            {IS_DEMO && (
              <span className="text-xs px-2 py-0.5 bg-accent/15 text-accent-light rounded-full font-medium border border-accent/20">
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

      <main className="bg-grid min-h-[calc(100vh-3.5rem)]">{children}</main>
    </div>
  );
}
