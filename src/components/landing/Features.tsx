'use client';

import { useEffect, useRef, useState } from 'react';
import { LinkIcon, LayoutGrid, SearchCheck, Tags } from 'lucide-react';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  gradient: string;
  iconColor: string;
}

const features: Feature[] = [
  {
    icon: LinkIcon,
    title: 'Save Anything',
    description: 'Store links, posts, images and notes from anywhere on the internet.',
    gradient: 'from-violet-500/15 to-purple-600/15',
    iconColor: 'text-violet-400',
  },
  {
    icon: LayoutGrid,
    title: 'Memory Cards',
    description: 'Everything becomes a rich visual card with previews and metadata.',
    gradient: 'from-cyan-500/15 to-blue-600/15',
    iconColor: 'text-cyan-400',
  },
  {
    icon: SearchCheck,
    title: 'Natural Search',
    description: 'Find content using everyday language. Just ask like you\'d ask a friend.',
    gradient: 'from-emerald-500/15 to-teal-600/15',
    iconColor: 'text-emerald-400',
  },
  {
    icon: Tags,
    title: 'AI Organization',
    description: 'Automatic tagging and categorization. Zero effort from you.',
    gradient: 'from-orange-500/15 to-amber-600/15',
    iconColor: 'text-orange-400',
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
    <section ref={sectionRef} className="relative section-padding bg-grid">
      <div className="glow-orb w-[400px] h-[400px] bg-accent top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-15" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-primary-light text-sm font-semibold uppercase tracking-widest mb-4">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
            Everything you need to{' '}
            <span className="gradient-text">never forget.</span>
          </h2>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`group glass rounded-2xl p-8 hover:border-border-strong transition-all duration-500 hover:translate-y-[-4px] hover:shadow-xl hover:shadow-primary/5 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${index * 100 + 200}ms` }}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary-light transition-colors">
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
