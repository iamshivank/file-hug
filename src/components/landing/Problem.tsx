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
    title: 'Buried ChatGPT conversations',
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
    <section ref={sectionRef} className="relative section-padding bg-dots">
      {/* Glow */}
      <div className="glow-orb w-[400px] h-[400px] bg-red-500/30 top-1/4 right-[-100px]" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            The internet is your{' '}
            <span className="gradient-text">second memory.</span>
          </h2>
          <p className="text-muted-light text-lg max-w-xl mx-auto">
            But right now, it&apos;s a memory with holes everywhere.
          </p>
        </div>

        {/* Problem cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
          {problems.map((problem, index) => {
            const Icon = problem.icon;
            return (
              <div
                key={problem.title}
                className={`glass rounded-2xl p-6 hover:border-red-500/20 transition-all duration-500 hover:translate-y-[-2px] group ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${index * 100 + 200}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4 group-hover:bg-red-500/20 transition-colors">
                  <Icon className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">{problem.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{problem.description}</p>
              </div>
            );
          })}
        </div>

        {/* Bottom message */}
        <div
          className={`text-center transition-all duration-700 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="glass-strong inline-block rounded-2xl px-8 py-6 max-w-lg">
            <p className="text-lg text-foreground font-medium mb-2">
              People remember <span className="text-primary-light">seeing</span> something.
            </p>
            <p className="text-muted-light">
              They don&apos;t remember <span className="text-red-400">where</span> they saved it.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
