import Link from 'next/link';
import {
  ArrowRight,
  Check,
  CircleCheck,
  CloudDownload,
  FileText,
  Heart,
  Link2,
  Play,
  Search,
  Sparkles,
} from 'lucide-react';
import ThemeToggle from '@/features/theme/ThemeToggle';
import { AuthProvider } from '@/features/auth/AuthProvider';
import UserMenu from '@/features/auth/UserMenu';
import type { SessionUser } from '@/features/auth/session';
import { PLAN_LIST, type Plan, type PlanId } from '@/features/billing/plans';
import HeroExperience from './hero/HeroExperience';
import PlatformOrbit from './PlatformOrbit';
import SearchDemo from './SearchDemo';
import TiltCard from './TiltCard';

/** The signed-in visitor, resolved on the server. Null for visitors and demo sessions. */
export interface LandingViewer {
  user: SessionUser;
  plan: PlanId;
}

function Mark({ size = 15 }: { size?: number }) {
  return (
    <span className="lp-mark" aria-hidden="true">
      <Heart size={size} strokeWidth={2.4} />
    </span>
  );
}

function Nav({ viewer }: { viewer: LandingViewer | null }) {
  return (
    <header className="lp-nav">
      <Link href="/" className="lp-brand" aria-label="File Hug home">
        <Mark />
        <span>File Hug</span>
      </Link>
      <nav aria-label="Main navigation" className="lp-nav-links">
        <a href="#method">How it works</a>
        <a href="#features">Search</a>
        <a href="#platforms">Platforms</a>
        <a href="#pricing">Pricing</a>
      </nav>
      <div className="lp-nav-actions">
        <ThemeToggle />
        {viewer ? (
          <>
            {/* Same account menu as the app — Profile and Sign out. */}
            <AuthProvider initialUser={viewer.user}>
              <UserMenu />
            </AuthProvider>
            <Link href="/app" className="lp-btn lp-btn-primary lp-btn-sm">
              Open library
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className="lp-nav-signin">
              Sign in
            </Link>
            <Link href="/login" className="lp-btn lp-btn-primary lp-btn-sm">
              Get started
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

function MethodSection() {
  return (
    <section id="method" className="lp-section" aria-labelledby="method-title">
      <div className="lp-section-head">
        <p className="lp-kicker">02 / How it works</p>
        <h2 id="method-title" className="lp-h2">
          Save messy. <em>Find precisely.</em>
        </h2>
        <p className="lp-lead">
          Built for the way people actually browse: fast, across a dozen apps, with no time to
          organise anything in the moment.
        </p>
      </div>

      <ol className="lp-steps">
        <li>
          <TiltCard className="lp-step">
            <span className="lp-step-num lp-depth-1">01</span>
            <div className="lp-step-visual lp-depth-2">
              <div className="lp-mini-composer">
                <Link2 size={15} aria-hidden="true" />
                <span className="lp-mini-url">instagram.com/reel/C9xQ2…</span>
                <span className="lp-mini-save">Save</span>
              </div>
              <div className="lp-mini-detect">
                <span className="lp-pill">Instagram · Reel</span>
                <span className="lp-pill lp-pill-quiet">#weekend</span>
              </div>
            </div>
            <h3 className="lp-depth-1">Drop it in</h3>
            <p className="lp-depth-1">
              Paste any link or jot a note. File Hug recognises the platform and keeps your own name
              and tags alongside it.
            </p>
          </TiltCard>
        </li>
        <li>
          <TiltCard className="lp-step">
            <span className="lp-step-num lp-depth-1">02</span>
            <div className="lp-step-visual lp-depth-2">
              <ul className="lp-mini-checks">
                <li><CircleCheck size={14} aria-hidden="true" /> Title &amp; description</li>
                <li><CircleCheck size={14} aria-hidden="true" /> Transcript · 214 words</li>
                <li><CircleCheck size={14} aria-hidden="true" /> Keywords · sourdough, levain</li>
                <li className="lp-mini-reading"><span className="lp-spinner" aria-hidden="true" /> Reading page text…</li>
              </ul>
            </div>
            <h3 className="lp-depth-1">We read it</h3>
            <p className="lp-depth-1">
              In the background, every link is opened and read: page text, video transcripts and
              metadata, indexed for words and for meaning.
            </p>
          </TiltCard>
        </li>
        <li>
          <TiltCard className="lp-step">
            <span className="lp-step-num lp-depth-1">03</span>
            <div className="lp-step-visual lp-depth-2">
              <div className="lp-mini-composer">
                <Search size={15} aria-hidden="true" />
                <span className="lp-mini-url">bread video from last month</span>
              </div>
              <div className="lp-mini-result">
                <Sparkles size={13} aria-hidden="true" />
                <span>72-hour sourdough, the lazy way</span>
              </div>
            </div>
            <h3 className="lp-depth-1">Call it back</h3>
            <p className="lp-depth-1">
              Ask in plain words. Search runs across titles, tags, notes and everything inside the
              links themselves.
            </p>
          </TiltCard>
        </li>
      </ol>
    </section>
  );
}

/** Where a plan's button goes, and what it says, for this visitor. */
function planCta(plan: Plan, viewer: LandingViewer | null): { href: string; label: string } {
  if (!viewer) {
    return plan.id === 'free'
      ? { href: '/login', label: 'Start free' }
      : { href: `/login?plan=${plan.id}`, label: `Choose ${plan.name}` };
  }
  if (plan.id === viewer.plan) return { href: '/app/profile', label: 'Your current plan' };
  if (plan.id === 'free') return { href: '/app', label: 'Open library' };
  return { href: `/app/profile?plan=${plan.id}`, label: `Switch to ${plan.name}` };
}

function PlanCard({ plan, viewer }: { plan: Plan; viewer: LandingViewer | null }) {
  const cta = planCta(plan, viewer);
  const isCurrent = viewer?.plan === plan.id;
  return (
    <TiltCard className={`lp-plan ${plan.highlight ? 'lp-plan-featured' : ''}`} max={6}>
      <div className="lp-plan-head lp-depth-1">
        <h3>{plan.name}</h3>
        {isCurrent ? (
          <span className="lp-plan-badge">Your plan</span>
        ) : (
          plan.highlight && <span className="lp-plan-badge">Most chosen</span>
        )}
      </div>
      <p className="lp-plan-tagline lp-depth-1">{plan.tagline}</p>
      <p className="lp-plan-price lp-depth-2">
        ₹{plan.priceInr}
        <span>/{plan.period === 'forever' ? 'forever' : 'month'}</span>
      </p>
      <ul className="lp-plan-features">
        {plan.features.map((feature) => {
          const soon = feature.includes('(coming soon)');
          return (
            <li key={feature}>
              {feature.includes('Archive supported videos') ? (
                <CloudDownload size={15} aria-hidden="true" />
              ) : (
                <Check size={15} aria-hidden="true" />
              )}
              <span>
                {feature.replace(' (coming soon)', '')}
                {soon && <em>Coming soon</em>}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href={cta.href}
        className={`lp-btn ${plan.highlight && !isCurrent ? 'lp-btn-primary' : 'lp-btn-ghost'} lp-plan-cta lp-depth-1`}
      >
        {cta.label}
        {isCurrent ? <Check size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
      </Link>
    </TiltCard>
  );
}

export default function LandingPage({ viewer = null }: { viewer?: LandingViewer | null }) {
  return (
    <div className="lp-root">
      <Nav viewer={viewer} />

      <main>
        <HeroExperience signedIn={!!viewer} />

        <MethodSection />

        <section id="features" className="lp-section lp-section-band" aria-label="Live search demo">
          <SearchDemo />
        </section>

        <section id="platforms" className="lp-section" aria-labelledby="platforms-title">
          <div className="lp-platforms">
            <div className="lp-section-head lp-section-head-tight">
              <p className="lp-kicker">04 / Everywhere you browse</p>
              <h2 id="platforms-title" className="lp-h2">
                If it has a link, <em>it has a home.</em>
              </h2>
              <p className="lp-lead">
                Reels, threads, repos, chats, playlists, plus the notes you write about them. Spin
                the ring. Every one of these is recognised, previewed and read.
              </p>
              <ul className="lp-proof">
                <li><FileText size={15} aria-hidden="true" /> Notes and links connect to each other</li>
                <li><Play size={15} aria-hidden="true" /> Videos play inline, right in your library</li>
                <li><Sparkles size={15} aria-hidden="true" /> Grouped by platform automatically</li>
              </ul>
            </div>
            <PlatformOrbit />
          </div>
        </section>

        <section id="pricing" className="lp-section" aria-labelledby="pricing-title">
          <div className="lp-section-head lp-section-head-center">
            <p className="lp-kicker">05 / Pricing</p>
            <h2 id="pricing-title" className="lp-h2">
              Start small. <em>Keep everything.</em>
            </h2>
            <p className="lp-lead">Clear limits, no annual lock-in, and a genuinely useful free plan.</p>
          </div>
          <div className="lp-plans">
            {PLAN_LIST.map((plan) => (
              <PlanCard key={plan.id} plan={plan} viewer={viewer} />
            ))}
          </div>
        </section>

        <section className="lp-final" aria-labelledby="final-title">
          <div className="lp-final-glow" aria-hidden="true" />
          <p className="lp-kicker">Close the tabs</p>
          <h2 id="final-title" className="lp-final-title">
            Never lose something you <em>wanted to remember.</em>
          </h2>
          {viewer ? (
            <div className="lp-final-actions">
              <Link href="/app" className="lp-btn lp-btn-primary lp-btn-lg">
                Open your library <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <>
              <div className="lp-final-actions">
                <Link href="/login" className="lp-btn lp-btn-primary lp-btn-lg">
                  Get started free <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a href="/api/auth/demo" className="lp-btn lp-btn-ghost lp-btn-lg">
                  <Play size={16} aria-hidden="true" /> Try the live demo
                </a>
              </div>
              <p className="lp-final-note">
                Already saving? <Link href="/app">Open your library</Link>
              </p>
            </>
          )}
        </section>
      </main>

      <footer className="lp-footer">
        <Link href="/" className="lp-brand" aria-label="File Hug home">
          <Mark size={13} />
          <span>File Hug</span>
        </Link>
        <p>Made for tabs worth keeping. © {new Date().getFullYear()}</p>
        <nav aria-label="Footer">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/app">Library</Link>
          {viewer ? <Link href="/app/profile">Profile</Link> : <Link href="/login">Sign in</Link>}
          <Link href="/feedback?from=landing&page=%2F">Feedback</Link>
        </nav>
      </footer>
    </div>
  );
}
