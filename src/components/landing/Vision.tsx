'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Search, Users } from 'lucide-react';

interface VisionQuery {
  icon: React.ElementType;
  query: string;
  gradient: string;
}

const queries: VisionQuery[] = [
  {
    icon: MessageSquare,
    query: '"What was that Germany university reel?"',
    gradient: 'from-violet-500/20 to-purple-600/10',
  },
  {
    icon: Search,
    query: '"Find all startup ideas from 2026."',
    gradient: 'from-cyan-500/20 to-blue-600/10',
  },
  {
    icon: Users,
    query: '"Show memes shared with Rahul."',
    gradient: 'from-emerald-500/20 to-teal-600/10',
  },
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
    <section ref={sectionRef} className="relative section-padding bg-dots">
      <div className="glow-orb w-[500px] h-[500px] bg-accent top-1/3 right-[-200px] opacity-20" />
      <div className="glow-orb w-[300px] h-[300px] bg-primary bottom-1/4 left-[-100px] opacity-15" />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-primary-light text-sm font-semibold uppercase tracking-widest mb-4">
            The Vision
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Your personal{' '}
            <span className="gradient-text">memory assistant.</span>
          </h2>
          <p className="text-muted-light text-lg max-w-lg mx-auto">
            Imagine asking your memory a question and getting the perfect answer.
          </p>
        </div>

        {/* Query cards */}
        <div className="space-y-4">
          {queries.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.query}
                className={`group glass rounded-2xl p-6 hover:border-border-strong transition-all duration-500 hover:translate-x-2 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                }`}
                style={{ transitionDelay: `${index * 150 + 300}ms` }}
              >
                <div className="flex items-center gap-5">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-5 h-5 text-primary-light" />
                  </div>
                  <p className="text-lg md:text-xl text-foreground font-medium italic">
                    {item.query}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <div
          className={`text-center mt-12 transition-all duration-700 delay-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <p className="text-muted text-sm">
            File Hug understands context, time, people, and topics — just like your brain.
          </p>
        </div>
      </div>
    </section>
  );
}
