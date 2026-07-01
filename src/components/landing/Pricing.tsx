'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
import { PLAN_LIST, type Plan } from '@/features/billing/plans';

function priceLabel(plan: Plan): string {
  if (plan.priceInr === 0) return 'Free forever';
  return `₹${plan.priceInr}`;
}

function ctaLabel(plan: Plan): string {
  if (plan.id === 'free') return 'Get started';
  if (plan.id === 'ai') return 'Go AI';
  return 'Upgrade';
}

function ctaHref(plan: Plan): string {
  // Free routes straight to login; paid plans carry the intent so a logged-in
  // user can be routed to checkout from their Profile.
  return plan.id === 'free' ? '/login' : `/login?plan=${plan.id}`;
}

export default function Pricing() {
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
    <section ref={sectionRef} id="pricing" className="relative section-padding overflow-hidden">
      <div className="glow-orb w-100 h-100 bg-primary top-1/4 -left-32" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-14 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-primary-light text-xs font-semibold uppercase tracking-[0.2em] mb-4">
            Pricing
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl mb-5">
            Simple plans that{' '}
            <span className="gradient-text italic">grow with you.</span>
          </h2>
          <p className="text-muted-light text-lg max-w-md mx-auto">
            Start free. Upgrade when you want faster search and AI that understands you.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {PLAN_LIST.map((plan, index) => {
            const highlighted = Boolean(plan.highlight);
            const cardClasses = highlighted
              ? 'gradient-border p-8 rounded-2xl'
              : 'card p-8';

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                } ${highlighted ? 'md:-mt-3 md:mb-3' : ''}`}
                style={{ transitionDelay: `${index * 110 + 250}ms` }}
              >
                <div className={`relative flex flex-col h-full ${cardClasses}`}>
                  {highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-background text-xs font-semibold shadow-lg shadow-primary/25">
                      <Sparkles className="w-3.5 h-3.5" />
                      Most popular
                    </span>
                  )}

                  {/* Name + tagline */}
                  <div className="mb-5">
                    <h3
                      className={`font-display text-2xl mb-1.5 ${
                        highlighted ? 'text-primary-light' : 'text-foreground'
                      }`}
                    >
                      {plan.name}
                    </h3>
                    <p className="text-muted-light text-sm leading-relaxed">{plan.tagline}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {plan.priceInr === 0 ? (
                      <p className="font-display text-3xl text-foreground">Free forever</p>
                    ) : (
                      <p className="flex items-baseline gap-1.5">
                        <span className="font-display text-4xl text-foreground">
                          {priceLabel(plan)}
                        </span>
                        <span className="text-muted text-sm">/{plan.period}</span>
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 border border-border flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-primary-light" />
                        </span>
                        <span className="text-muted-light text-sm leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={ctaHref(plan)}
                    className={`group inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl font-semibold transition-all duration-300 cursor-pointer ${
                      highlighted
                        ? 'bg-primary hover:bg-primary-light text-background shadow-lg shadow-primary/20 hover:shadow-primary/35'
                        : 'bg-surface hover:bg-surface-hover text-foreground border border-border hover:border-border-strong'
                    }`}
                  >
                    {ctaLabel(plan)}
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
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
            Prices in Indian Rupees. Cancel anytime — no lock-in.
          </p>
        </div>
      </div>
    </section>
  );
}
