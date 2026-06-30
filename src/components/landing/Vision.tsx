'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Search, Users } from 'lucide-react';

interface VisionQuery {
  icon: React.ElementType;
  query: string;
}

const queries: VisionQuery[] = [
  { icon: MessageSquare, query: 'What was that Germany university reel?' },
  { icon: Search, query: 'Find all the startup ideas from 2026.' },
  { icon: Users, query: 'Show me the memes I shared with Rahul.' },
];

export default function Vision() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative section-padding overflow-hidden">
      <div className="glow-orb w-100 h-100 bg-accent top-1/3 -right-32" />

      <div className="relative z-10 max-w-3xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-primary-light text-xs font-semibold uppercase tracking-[0.2em] mb-4">
            The vision
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl mb-5">
            Your personal{' '}
            <span className="gradient-text italic">memory assistant.</span>
          </h2>
          <p className="text-muted-light text-lg max-w-md mx-auto">
            Imagine asking your memory a question — and getting the perfect answer back.
          </p>
        </div>

        {/* Query cards */}
        <div className="space-y-3">
          {queries.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.query}
                className={`group card p-5 hover:border-border-strong hover:bg-surface-hover transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                }`}
                style={{ transitionDelay: `${index * 130 + 300}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 border border-border flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary-light" />
                  </div>
                  <p className="font-display text-lg md:text-xl text-foreground italic">
                    &ldquo;{item.query}&rdquo;
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <div
          className={`text-center mt-10 transition-all duration-700 delay-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="text-muted text-sm">
            File Hug understands context, time, people and topics — just like your brain.
          </p>
        </div>
      </div>
    </section>
  );
}
