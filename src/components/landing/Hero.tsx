'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bookmark, Search, Sparkles, ArrowRight, ArrowUpRight } from 'lucide-react';

interface MemoryCard {
  title: string;
  source: string;
  timeAgo: string;
  icon: 'bookmark' | 'search' | 'sparkles';
}

const memoryCards: MemoryCard[] = [
  {
    title: 'Germany University SOP Guide',
    source: 'chatgpt.com',
    timeAgo: '2 months ago',
    icon: 'bookmark',
  },
  {
    title: 'Funny Software Engineer Meme',
    source: 'instagram.com',
    timeAgo: '3 weeks ago',
    icon: 'sparkles',
  },
  {
    title: 'Startup Pricing Strategy',
    source: 'medium.com',
    timeAgo: 'yesterday',
    icon: 'search',
  },
];

const iconMap = {
  bookmark: Bookmark,
  search: Search,
  sparkles: Sparkles,
};

export default function Hero() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const scrollToWaitlist = () => {
    document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Warm ambient glow — single, off-center */}
      <div className="glow-orb w-125 h-125 bg-primary -top-32 left-1/4 -translate-x-1/2 animate-pulse-glow" />
      <div className="bg-grid absolute inset-0 opacity-60" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-28 md:py-32 flex flex-col items-center">
        {/* Eyebrow */}
        <div
          className={`mb-8 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border text-sm text-primary-light">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="text-muted-light">Your AI-powered memory for everything</span>
          </div>
        </div>

        {/* Headline */}
        <h1
          className={`font-display text-5xl sm:text-6xl md:text-7xl text-center leading-[1.05] max-w-3xl mb-7 transition-all duration-700 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Never lose something{' '}
          <span className="gradient-text italic">you wanted to remember.</span>
        </h1>

        {/* Subheading */}
        <p
          className={`text-lg sm:text-xl text-muted-light text-center max-w-xl mb-10 leading-relaxed transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Save reels, articles, ChatGPT threads, memes, links and ideas in one warm,
          searchable place — then find them later just by asking.
        </p>

        {/* CTAs */}
        <div
          className={`flex flex-col items-center gap-5 mb-20 transition-all duration-700 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={scrollToWaitlist}
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-primary hover:bg-primary-light text-background font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/35 cursor-pointer"
            >
              Join the waitlist
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={scrollToHowItWorks}
              className="px-7 py-3.5 border border-border hover:border-border-strong text-foreground font-medium rounded-xl transition-all duration-300 hover:bg-surface-hover cursor-pointer"
            >
              See how it works
            </button>
          </div>
          <Link
            href="/app"
            className="group inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary-light transition-colors"
          >
            <span className="underline decoration-border underline-offset-4 group-hover:decoration-primary">
              Try the live demo
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>

        {/* Memory cards */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full transition-all duration-1000 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          {memoryCards.map((card, index) => {
            const IconComponent = iconMap[card.icon];
            return (
              <div
                key={card.title}
                className={`group card p-5 text-left hover:border-border-strong transition-all duration-500 hover:-translate-y-1 ${
                  index === 1 ? 'animate-float-delayed' : index === 2 ? 'animate-float-slow' : 'animate-float'
                }`}
                style={{ animationDelay: `${index * 0.6}s` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-border flex items-center justify-center">
                    <IconComponent className="w-4 h-4 text-primary-light" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h3 className="font-medium text-foreground mb-3 leading-snug group-hover:text-primary-light transition-colors">
                  {card.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>{card.source}</span>
                  <span className="w-1 h-1 rounded-full bg-muted/50" />
                  <span>{card.timeAgo}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
}
