'use client';

import { useEffect, useRef, useState, FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Loader2, AlertCircle, Users } from 'lucide-react';
import type { ApiResponse, WaitlistSuccessData, WaitlistCountData } from '@/types/waitlist.types';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

export default function Waitlist() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');
  const [position, setPosition] = useState<number | null>(null);
  const [count, setCount] = useState<number | null>(null);

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

  useEffect(() => {
    fetch('/api/waitlist')
      .then((res) => res.json())
      .then((data: ApiResponse<WaitlistCountData>) => {
        if (data.success && data.data) {
          setCount(data.data.count);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      const data: ApiResponse<WaitlistSuccessData> = await response.json();

      if (data.success && data.data) {
        setStatus('success');
        setMessage("You're on the list! We'll be in touch soon.");
        setPosition(data.data.position);
        setCount(data.data.position);
        setName('');
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  };

  return (
    <section ref={sectionRef} id="waitlist" className="relative section-padding bg-dots">
      <div className="glow-orb w-125 h-125 bg-primary top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      <div className="relative z-10 max-w-md mx-auto">
        {/* Heading */}
        <div
          className={`text-center mb-9 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <p className="text-primary-light text-xs font-semibold uppercase tracking-[0.2em] mb-4">
            Early access
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl mb-4">
            Be among the{' '}
            <span className="gradient-text italic">first users.</span>
          </h2>
          <p className="text-muted-light">
            Join the waitlist and get early access the day we launch.
          </p>

          {count !== null && count > 0 && (
            <div className="mt-5 inline-flex items-center gap-2 border border-border px-4 py-2 rounded-full text-sm">
              <Users className="w-4 h-4 text-primary-light" />
              <span className="text-muted-light">
                Join{' '}
                <span className="text-primary-light font-semibold">{count.toLocaleString()}+</span>
                {' '}people already waiting
              </span>
            </div>
          )}
        </div>

        {/* Form */}
        <div
          className={`transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="gradient-border p-8 rounded-2xl">
            {status === 'success' ? (
              <div className="text-center py-8 animate-fade-in space-y-4">
                <CheckCircle2 className="w-12 h-12 text-success mx-auto" />

                <div>
                  <p className="font-display text-6xl gradient-text">#{position}</p>
                  <p className="text-muted text-sm mt-1">on the waitlist</p>
                </div>

                <div>
                  <h3 className="font-display text-xl text-foreground">Welcome aboard!</h3>
                  <p className="text-muted-light mt-1">{message}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="waitlist-name" className="block text-sm font-medium text-muted-light mb-2">
                    Name
                  </label>
                  <input
                    id="waitlist-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    required
                    maxLength={100}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="waitlist-email" className="block text-sm font-medium text-muted-light mb-2">
                    Email
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-foreground placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 transition-all"
                  />
                </div>

                {status === 'error' && (
                  <div className="flex items-center gap-2 text-danger text-sm animate-slide-up">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full group inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary hover:bg-primary-light text-background font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/35 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      Join the waitlist
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-muted">
                  No spam. We&apos;ll only email you when File Hug is ready.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
