'use client';

import { useEffect, useRef, useState } from 'react';
import { Save, Search, Brain } from 'lucide-react';

interface TimelineItem {
  month: string;
  label: string;
  dot: string;
  ring: string;
}

const timeline: TimelineItem[] = [
  { month: 'March', label: 'Germany university reel', dot: 'bg-primary', ring: 'bg-primary/15' },
  { month: 'April', label: 'Startup article', dot: 'bg-accent', ring: 'bg-accent/15' },
  { month: 'May', label: 'AI project idea', dot: 'bg-success', ring: 'bg-success/15' },
];

const pillars = [
  { icon: Save, title: 'Save anything', description: 'Links, reels, notes, memes — everything goes in one place.' },
  { icon: Search, title: 'Find everything', description: 'Natural-language search that actually understands you.' },
  { icon: Brain, title: 'Remember effortlessly', description: 'It organizes quietly in the background, so you never have to.' },
];

export default function Solution() {
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
      <div className="glow-orb w-100 h-100 bg-primary top-1/3 -left-32" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-primary-light text-xs font-semibold uppercase tracking-[0.2em] mb-4">
            The fix
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl">
            Meet <span className="gradient-text italic">File Hug.</span>
          </h2>
        </div>

        {/* Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-20">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className={`text-center transition-all duration-700 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
                style={{ transitionDelay: `${index * 150 + 200}ms` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-border flex items-center justify-center mx-auto mb-5">
                  <Icon className="w-6 h-6 text-primary-light" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-2">{pillar.title}</h3>
                <p className="text-muted-light text-sm leading-relaxed">{pillar.description}</p>
              </div>
            );
          })}
        </div>

        {/* Timeline */}
        <div
          className={`transition-all duration-700 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h3 className="text-center text-sm font-medium text-muted uppercase tracking-[0.15em] mb-10">
            Your memories, kept by time
          </h3>
          <div className="relative max-w-md mx-auto">
            {/* Vertical line */}
            <div className="absolute left-6 top-2 bottom-2 w-px bg-border" />

            {timeline.map((item, index) => (
              <div
                key={item.month}
                className={`relative flex items-center gap-6 mb-6 last:mb-0 transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                }`}
                style={{ transitionDelay: `${index * 200 + 700}ms` }}
              >
                {/* Dot */}
                <div className={`relative z-10 w-12 h-12 rounded-full ${item.ring} flex items-center justify-center shrink-0`}>
                  <div className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                </div>

                {/* Content */}
                <div className="card px-5 py-3 flex-1 hover:border-border-strong transition-colors">
                  <p className="text-xs text-muted uppercase tracking-wider">{item.month}</p>
                  <p className="text-foreground font-medium mt-0.5">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
