import { Navigation } from '@/features/landing/components/Navigation';
import { Hero } from '@/features/landing/components/Hero';
import { Marquee } from '@/features/landing/components/Marquee';
import { Features } from '@/features/landing/components/Features';
import { Showcase } from '@/features/landing/components/Showcase';
import { Modules } from '@/features/landing/components/Modules';
import { EmiliaAI } from '@/features/landing/components/EmiliaAI';
import { Testimonial } from '@/features/landing/components/Testimonial';
import { Pricing } from '@/features/landing/components/Pricing';
import { CTA } from '@/features/landing/components/CTA';
import { Footer } from '@/features/landing/components/Footer';
import { CursorGlow } from '@/features/landing/components/CursorGlow';

const Index = () => (
  <main className="min-h-screen bg-[#0a0a0f] relative">
    <CursorGlow />
    <Navigation />
    <Hero />
    <Marquee />
    <Features />
    <Showcase />
    <Modules />
    <EmiliaAI />
    <Testimonial />
    <Pricing />
    <CTA />
    <Footer />
  </main>
);

export default Index;
