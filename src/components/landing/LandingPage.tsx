import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  Bookmark,
  Check,
  CirclePlay,
  CloudDownload,
  Heart,
  Link2,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react';
import { PLAN_LIST, type Plan } from '@/features/billing/plans';
import LandingScene from './LandingScene';

const savedItems = [
  { type: 'VIDEO', title: 'A perfect 12-minute focaccia', source: 'youtube.com', tag: 'cook later' },
  { type: 'ARTICLE', title: 'The small-web renaissance', source: 'theverge.com', tag: 'research' },
  { type: 'THREAD', title: 'How tiny teams ship faster', source: 'x.com', tag: 'work' },
];

function Mark() {
  return (
    <span className="landing-mark" aria-hidden="true">
      <Heart size={15} strokeWidth={2.4} />
    </span>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article className={`price-card ${plan.highlight ? 'price-card-featured' : ''}`}>
      <div>
        <div className="price-card-head">
          <span className="kicker">{plan.name}</span>
          {plan.highlight && <span className="popular-label">MOST CHOSEN</span>}
        </div>
        <p className="price-tagline">{plan.tagline}</p>
        <p className="price-value">
          {plan.priceInr === 0 ? '₹0' : `₹${plan.priceInr}`}
          <span>/{plan.period === 'forever' ? 'forever' : 'month'}</span>
        </p>
      </div>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>
            {feature.includes('Archive supported videos') ? <CloudDownload size={15} /> : <Check size={15} />}
            <span>{feature.replace(' (coming soon)', '')}{feature.includes('(coming soon)') && <em>COMING SOON</em>}</span>
          </li>
        ))}
      </ul>
      <Link href={plan.id === 'free' ? '/login' : `/login?plan=${plan.id}`} className="price-cta">
        {plan.id === 'free' ? 'Start free' : `Choose ${plan.name}`}
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <header className="landing-nav">
        <Link href="/" className="brand-lockup" aria-label="File Hug home">
          <Mark />
          <span>FILE HUG</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#method">How it works</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <Link href="/login" className="nav-cta">
          Sign in <ArrowRight size={15} />
        </Link>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="hero-index">[ YOUR OTHER MEMORY ]</p>
            <h1>
              Keep the internet<br />
              you <span>meant</span> to<br />
              remember.
            </h1>
            <p className="hero-deck">
              One considered home for the videos, links, notes and half-finished thoughts
              you&apos;ll actually want again.
            </p>
            <div className="hero-actions">
              <Link href="/login" className="primary-cta">
                Get started <ArrowRight size={18} />
              </Link>
              <a href="#method" className="text-cta">
                <CirclePlay size={18} /> See how it works
              </a>
            </div>
            <div className="hero-note">
              <span>01</span>
              <p>No folders to maintain.<br />No perfect system required.</p>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-stamp">SAVE NOW<br />FIND LATER</div>
            <LandingScene />
            <div className="scene-caption">
              <span>3D / LIVE</span>
              <p>Your scattered tabs,<br />finally held together.</p>
            </div>
          </div>
          <a href="#method" className="scroll-cue" aria-label="Scroll to how it works">
            <ArrowDown size={17} /> SCROLL TO UNPACK
          </a>
        </section>

        <div className="ticker" aria-hidden="true">
          <div>
            <span>REELS</span><i>✦</i><span>ARTICLES</span><i>✦</i><span>THREADS</span><i>✦</i>
            <span>RECIPES</span><i>✦</i><span>IDEAS</span><i>✦</i><span>VIDEOS</span><i>✦</i>
          </div>
        </div>

        <section id="method" className="method-section">
          <div className="section-number">02 / THE METHOD</div>
          <div className="method-heading">
            <h2>Save messy.<br /><span>Find precisely.</span></h2>
            <p>
              File Hug is built for the way people actually browse: quickly, across platforms,
              with no time to organise everything in the moment.
            </p>
          </div>

          <div className="method-grid">
            <article>
              <span className="step-number">01</span>
              <div className="step-icon"><Link2 size={22} /></div>
              <h3>Drop it in</h3>
              <p>Paste any link or write a note. Give the link a useful name and your own tags while it&apos;s fresh.</p>
            </article>
            <article className="method-invert">
              <span className="step-number">02</span>
              <div className="step-icon"><Tag size={22} /></div>
              <h3>Make it yours</h3>
              <p>“Camera research” is more useful than a URL. Tags keep your language attached to every save.</p>
            </article>
            <article>
              <span className="step-number">03</span>
              <div className="step-icon"><Search size={22} /></div>
              <h3>Call it back</h3>
              <p>Search titles, tags, notes, platforms and links from one fast, forgiving search box.</p>
            </article>
          </div>
        </section>

        <section id="features" className="product-section">
          <div className="product-copy">
            <p className="section-number">03 / BUILT FOR RECALL</p>
            <h2>A library that<br />speaks <span>your language.</span></h2>
            <p className="product-deck">
              Search “that orange chair” instead of remembering which app, account or month it came from.
            </p>
            <ul className="feature-list">
              <li><b>A</b><span><strong>Name every save</strong>Turn raw URLs into cues your brain recognises.</span></li>
              <li><b>B</b><span><strong>Tag in your own words</strong>Add context like “client”, “weekend” or “buy later”.</span></li>
              <li><b>C</b><span><strong>Connect notes and links</strong>Keep the thought beside the thing that started it.</span></li>
            </ul>
          </div>

          <div className="library-window">
            <div className="window-bar">
              <span className="mini-brand"><Mark /> FILE HUG</span>
              <span>LIBRARY / 128</span>
            </div>
            <div className="search-demo"><Search size={18} /><span>weekend things to cook</span><kbd>⌘ K</kbd></div>
            <div className="saved-grid">
              {savedItems.map((item, index) => (
                <article key={item.title} className={index === 0 ? 'saved-card-active' : ''}>
                  <div className={`saved-thumb saved-thumb-${index + 1}`}><Bookmark size={18} /></div>
                  <span className="saved-type">{item.type}</span>
                  <h3>{item.title}</h3>
                  <p>{item.source}</p>
                  <span className="saved-tag">#{item.tag}</span>
                </article>
              ))}
            </div>
            <div className="result-line"><Sparkles size={15} /> 3 things you saved match this thought</div>
          </div>
        </section>

        <section className="archive-section">
          <div className="archive-badge">COMING SOON / AI PLAN</div>
          <CloudDownload className="archive-icon" strokeWidth={1.25} />
          <div>
            <h2>The link can disappear.<br /><span>The video doesn&apos;t have to.</span></h2>
            <p>
              AI members will be able to download supported videos and keep a private copy on
              File Hug&apos;s servers—original context, custom name and tags included.
            </p>
          </div>
          <Link href="/login?plan=ai" className="archive-cta">
            Get AI for ₹199/month <ArrowRight size={18} />
          </Link>
        </section>

        <section id="pricing" className="pricing-section">
          <div className="pricing-intro">
            <p className="section-number">04 / PICK YOUR SHELF</p>
            <h2>Start small.<br /><span>Keep everything.</span></h2>
            <p>Clear limits, no annual lock-in, and a useful free plan.</p>
          </div>
          <div className="pricing-grid">
            {PLAN_LIST.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
          </div>
        </section>

        <section className="final-cta-section">
          <p>[ CLOSE THE TABS ]</p>
          <h2>Your next good find<br />deserves a way back.</h2>
          <Link href="/login" className="final-cta">
            <span>Get started</span><ArrowRight size={28} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="brand-lockup"><Mark /><span>FILE HUG</span></div>
        <p>Made for tabs worth keeping. © {new Date().getFullYear()}</p>
        <div><a href="#features">Features</a><a href="#pricing">Pricing</a><Link href="/login">Sign in</Link></div>
      </footer>
    </div>
  );
}
