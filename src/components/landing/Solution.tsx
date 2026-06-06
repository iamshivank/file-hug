'use client';

import { useEffect, useRef, useState } from 'react';
import { Save, Search, Brain } from 'lucide-react';

interface TimelineItem {
  month: string;
  label: string;
  color: string;
}

const timeline: TimelineItem[] = [
  { month: 'March', label: 'Germany university reel', color: 'bg-violet-500' },
  { month: 'April', label: 'Startup article', color: 'bg-cyan-500' },
  { month: 'May', label: 'AI project idea', color: 'bg-emerald-500' },
];

const pillars = [
  { icon: Save, title: 'Save anything.', description: 'Links, reels, notes, memes — everything goes in.' },
  { icon: Search, title: 'Find everything.', description: 'Natural language search that actually works.' },
  { icon: Brain, title: 'Remember effortlessly.', description: 'AI organizes so you never have to.' },
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
    <section ref={sectionRef} className="relative section-padding">
      {/* Glow */}
      <div className="glow-orb w-[500px] h-[500px] bg-primary top-1/3 left-[-150px]" />
      <div className="glow-orb w-[300px] h-[300px] bg-accent bottom-1/4 right-[-100px]" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Meet <span className="gradient-text">File Hug.</span>
          </h2>
        </div>

        {/* Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
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
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-5 hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-primary-light" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{pillar.title}</h3>
                <p className="text-muted-light text-sm">{pillar.description}</p>
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
          <h3 className="text-center text-xl font-semibold text-muted-light mb-10">
            Your memories, organized by time
          </h3>
          <div className="relative max-w-md mx-auto">
            {/* Vertical line */}
            <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-accent/50 to-success/50" />

            {timeline.map((item, index) => (
              <div
                key={item.month}
                className={`relative flex items-center gap-6 mb-8 last:mb-0 transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                }`}
                style={{ transitionDelay: `${index * 200 + 700}ms` }}
              >
                {/* Dot */}
                <div className={`relative z-10 w-12 h-12 rounded-full ${item.color}/20 flex items-center justify-center shrink-0`}>
                  <div className={`w-3 h-3 rounded-full ${item.color}`} />
                </div>

                {/* Content */}
                <div className="glass rounded-xl px-5 py-3 flex-1 hover:border-border-strong transition-colors">
                  <p className="text-xs text-muted uppercase tracking-wider font-medium">{item.month}</p>
                  <p className="text-foreground font-medium mt-1">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
