import Link from 'next/link';
import { Heart, ArrowUpRight } from 'lucide-react';

const footerLinks = [
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Contact', href: '#' },
  { label: 'Twitter', href: '#' },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-border bg-background-elev">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-10">
          {/* Brand + demo link */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <Heart className="w-4 h-4 text-background fill-background" />
              </div>
              <span className="font-display text-xl text-foreground">File Hug</span>
            </div>
            <Link
              href="/login"
              className="group inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary-light transition-colors"
            >
              Open the demo app
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center gap-6">
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted hover:text-primary-light transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Copyright */}
        <div className="mt-10 pt-8 border-t border-border/60">
          <p className="text-sm text-muted">
            © {new Date().getFullYear()} File Hug — built with{' '}
            <Heart className="w-3 h-3 inline text-primary fill-primary align-baseline" /> for people who
            remember too much.
          </p>
        </div>
      </div>
    </footer>
  );
}
