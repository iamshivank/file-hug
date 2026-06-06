'use client';

import { useEffect, useRef, useState } from 'react';
import { Eye, Download, MessageSquare, Zap } from 'lucide-react';

interface Step {
  icon: React.ElementType;
  number: string;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const steps: Step[] = [
  {
    icon: Eye,
    number: '01',
    title: 'Find something interesting',
    description: 'A reel, article, meme, link, or idea you want to keep.',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
  },
  {
    icon: Download,
    number: '02',
    title: 'Save it to File Hug',
    description: 'One click. That\'s all it takes.',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
  },
  {
    icon: MessageSquare,
    number: '03',
    title: 'Ask in natural language',
    description: '"Show me startup ideas I saved in April."',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
  },
  {
    icon: Zap,
    number: '04',
    title: 'Get instant results',
    description: 'File Hug finds exactly what you\'re looking for.',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
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
    <section ref={sectionRef} id="how-it-works" className="relative section-padding">
      <div className="glow-orb w-[500px] h-[500px] bg-primary bottom-0 left-[-200px] opacity-20" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-primary-light text-sm font-semibold uppercase tracking-widest mb-4">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
            Simple as{' '}
            <span className="gradient-text">1-2-3-4.</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connecting line - desktop only */}
          <div className="hidden lg:block absolute top-1/2 left-[10%] right-[10%] h-px bg-gradient-to-r from-violet-500/30 via-cyan-500/30 via-emerald-500/30 to-amber-500/30 -translate-y-1/2" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className={`relative text-center transition-all duration-700 ${
                    isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  }`}
                  style={{ transitionDelay: `${index * 150 + 200}ms` }}
                >
                  {/* Step number */}
                  <div className="text-6xl font-black text-primary/10 mb-4 font-mono">
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div
                    className={`w-16 h-16 rounded-2xl ${step.bgColor} flex items-center justify-center mx-auto mb-5 hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className={`w-7 h-7 ${step.color}`} />
                  </div>

                  <h3 className="text-lg font-bold text-foreground mb-2">{step.title}</h3>
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
