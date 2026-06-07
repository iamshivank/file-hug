'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageOff, Link2Off, MessageSquareOff, BookmarkX } from 'lucide-react';

interface ProblemItem {
  icon: React.ElementType;
  title: string;
  description: string;
}

const problems: ProblemItem[] = [
  {
    icon: ImageOff,
    title: 'Lost Instagram reels',
    description: 'That perfect reel you watched at 2 AM? Gone forever in the infinite scroll.',
  },
  {
    icon: Link2Off,
    title: 'Forgotten WhatsApp links',
    description: 'Important links buried in 50 group chats you never check anymore.',
  },
  {
    icon: MessageSquareOff,
    title: 'Buried ChatGPT threads',
    description: 'Brilliant AI conversations lost in hundreds of untitled chats.',
  },
  {
    icon: BookmarkX,
    title: 'Missing bookmarks',
    description: 'Browser bookmarks so disorganized they might as well not exist.',
  },
];

export default function Problem() {
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
    <section ref={sectionRef} className="relative section-padding">
      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Heading */}
        <div
          className={`max-w-2xl mb-14 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-danger text-xs font-semibold uppercase tracking-[0.2em] mb-4">
            The problem
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl leading-tight mb-5">
            The internet is your{' '}
            <span className="gradient-text italic">second memory</span> — full of holes.
          </h2>
          <p className="text-muted-light text-lg">
            You remember <em className="text-foreground not-italic font-medium">seeing</em> it.
            You just can&apos;t remember <em className="text-danger not-italic font-medium">where</em> you put it.
          </p>
        </div>

        {/* Problem cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={problem.title}
                className={`bg-surface p-7 hover:bg-surface-hover transition-all duration-500 group ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${index * 90 + 200}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-danger/10 flex items-center justify-center shrink-0 group-hover:bg-danger/15 transition-colors">
                    <Icon className="w-5 h-5 text-danger" />
                  </div>
                  <div>
                    <h3 className="font-medium text-lg text-foreground mb-1.5">{problem.title}</h3>
                    <p className="text-muted text-sm leading-relaxed">{problem.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
