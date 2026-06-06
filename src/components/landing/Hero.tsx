'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bookmark, Search, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';

interface MemoryCard {
  title: string;
  source: string;
  timeAgo: string;
  icon: 'bookmark' | 'search' | 'sparkles';
  gradient: string;
}

const memoryCards: MemoryCard[] = [
  {
    title: 'Germany University SOP Guide',
    source: 'chatgpt.com',
    timeAgo: 'Saved 2 months ago',
    icon: 'bookmark',
    gradient: 'from-violet-500/20 to-purple-600/20',
  },
  {
    title: 'Funny Software Engineer Meme',
    source: 'instagram.com',
    timeAgo: 'Saved 3 weeks ago',
    icon: 'sparkles',
    gradient: 'from-cyan-500/20 to-blue-600/20',
  },
  {
    title: 'Startup Pricing Strategy',
    source: 'medium.com',
    timeAgo: 'Saved yesterday',
    icon: 'search',
    gradient: 'from-emerald-500/20 to-teal-600/20',
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
      {/* Background effects */}
      <div className="glow-orb w-150 h-150 bg-primary -top-50 -left-50" />
      <div className="glow-orb w-125 h-125 bg-accent -bottom-37.5 -right-37.5" />
      <div className="glow-orb w-75 h-75 bg-primary-light top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10" />

      {/* Grid background */}
      <div className="absolute inset-0 bg-grid opacity-40" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32 flex flex-col items-center">
        {/* Badge */}
        <div
          className={`mb-8 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="glass inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm text-primary-light">
            <Sparkles className="w-4 h-4" />
            <span>Your AI-powered memory for everything</span>
          </div>
        </div>

        {/* Headline */}
        <h1
          className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-center leading-tight max-w-4xl mb-6 transition-all duration-700 delay-100 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Never lose something{' '}
          <span className="gradient-text">you wanted to remember.</span>
        </h1>

        {/* Subheading */}
        <p
          className={`text-lg sm:text-xl text-muted-light text-center max-w-2xl mb-10 leading-relaxed transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          Save reels, articles, ChatGPT conversations, memes, links and ideas in one place.
          Search them later using natural language.
        </p>

        {/* CTAs */}
        <div
          className={`flex flex-col items-center gap-4 mb-20 transition-all duration-700 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={scrollToWaitlist}
              className="group relative px-8 py-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                Join Waitlist
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <button
              onClick={scrollToHowItWorks}
              className="px-8 py-4 glass hover:bg-surface-hover text-foreground font-semibold rounded-xl transition-all duration-300 hover:border-border-strong cursor-pointer"
            >
              See How It Works
            </button>
          </div>
          <Link
            href="/app"
            className="text-sm text-muted hover:text-primary-light transition-colors flex items-center gap-1.5 group"
          >
            <span>Try the demo app</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Memory Cards */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full transition-all duration-1000 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
        >
          {memoryCards.map((card, index) => {
            const IconComponent = iconMap[card.icon];
            return (
              <div
                key={card.title}
                className={`group glass rounded-2xl p-6 hover:border-border-strong transition-all duration-500 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 ${
                  index === 1 ? 'animate-float-delayed' : index === 2 ? 'animate-float-slow' : 'animate-float'
                }`}
                style={{ animationDelay: `${index * 0.5}s` }}
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-linear-to-br ${card.gradient} flex items-center justify-center mb-4`}
                >
                  <IconComponent className="w-5 h-5 text-primary-light" />
                </div>
                <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary-light transition-colors">
                  {card.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted mb-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>{card.source}</span>
                </div>
                <p className="text-xs text-muted">{card.timeAgo}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background to-transparent" />
    </section>
  );
}
