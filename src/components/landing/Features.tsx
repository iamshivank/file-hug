'use client';

import { useEffect, useRef, useState } from 'react';
import { LinkIcon, LayoutGrid, SearchCheck, Tags } from 'lucide-react';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: LinkIcon,
    title: 'Save anything',
    description: 'Store links, posts, images and notes from anywhere on the internet — one box, no friction.',
  },
  {
    icon: LayoutGrid,
    title: 'Memory cards',
    description: 'Everything becomes a clean visual card with previews, source and the moment you saved it.',
  },
  {
    icon: SearchCheck,
    title: 'Natural search',
    description: "Find content using everyday language. Just ask the way you'd ask a friend who never forgets.",
  },
  {
    icon: Tags,
    title: 'Quiet organization',
    description: 'Automatic tagging by platform and type. Zero filing, zero folders, zero effort from you.',
  },
];

export default function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 }
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
          <p className="text-primary-light text-xs font-semibold uppercase tracking-[0.2em] mb-4">
            Features
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl leading-tight">
            Everything you need to{' '}
            <span className="gradient-text italic">never forget.</span>
          </h2>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`group bg-surface p-8 hover:bg-surface-hover transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 90 + 200}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-border flex items-center justify-center mb-5 group-hover:border-border-strong transition-colors">
                  <Icon className="w-5 h-5 text-primary-light" />
                </div>
                <h3 className="font-display text-xl text-foreground mb-2.5 group-hover:text-primary-light transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-light text-sm leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
