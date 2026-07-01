import Hero from '@/components/landing/Hero';
import Problem from '@/components/landing/Problem';
import Solution from '@/components/landing/Solution';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import Vision from '@/components/landing/Vision';
import Pricing from '@/components/landing/Pricing';
import Waitlist from '@/components/landing/Waitlist';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <main className="flex-1">
      <Hero />
      <Problem />
      <Solution />
      <Features />
      <HowItWorks />
      <Vision />
      <Pricing />
      <Waitlist />
      <Footer />
    </main>
  );
}
