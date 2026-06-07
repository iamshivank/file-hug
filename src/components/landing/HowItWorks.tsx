'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, Download, MessageSquare, Zap } from 'lucide-react';

interface Step {
  icon: React.ElementType;
  number: string;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    icon: Eye,
    number: '01',
    title: 'Find something interesting',
    description: 'A reel, article, meme, link, or idea you want to keep.',
  },
  {
    icon: Download,
    number: '02',
    title: 'Save it to File Hug',
    description: "One click. That's all it takes.",
  },
  {
    icon: MessageSquare,
    number: '03',
    title: 'Ask in plain language',
    description: '"Show me the startup ideas I saved in April."',
  },
  {
    icon: Zap,
    number: '04',
    title: 'Get instant results',
    description: "File Hug finds exactly what you're looking for.",
  },
];

export default function HowItWorks() {
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
    <section ref={sectionRef} id="how-it-works" className="relative section-padding bg-grid">
      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-primary-light text-xs font-semibold uppercase tracking-[0.2em] mb-4">
            How it works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl">
            Simple as <span className="gradient-text italic">1&ndash;2&ndash;3&ndash;4.</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line - desktop only */}
          <div className="hidden lg:block absolute top-7 left-[12%] right-[12%] h-px bg-border -translate-y-1/2" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className={`relative text-center transition-all duration-700 ${
                    isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 130 + 200}ms` }}
                >
                  {/* Icon + number badge */}
                  <div className="relative w-14 h-14 mx-auto mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center">
                      <Icon className="w-6 h-6 text-primary-light" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-background text-xs font-bold flex items-center justify-center font-mono">
                      {index + 1}
                    </span>
                  </div>

                  <h3 className="font-medium text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
