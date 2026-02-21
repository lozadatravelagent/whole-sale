import { Navigation } from '@/features/landing/components/Navigation';
import { PublicChat } from '@/features/public-chat/PublicChat';
import { AboutUs } from '@/features/landing/components/AboutUs';
import { Features } from '@/features/landing/components/Features';
import { Showcase } from '@/features/landing/components/Showcase';
import { Testimonial } from '@/features/landing/components/Testimonial';
import { Pricing } from '@/features/landing/components/Pricing';
import { Footer } from '@/features/landing/components/Footer';
import { CursorGlow } from '@/features/landing/components/CursorGlow';

const Index = () => (
  <main className="landing-shell min-h-screen bg-[#0a0a0f] relative">
    <CursorGlow />
    <Navigation />
    <PublicChat />
    <AboutUs />
    <Features />
    <Showcase />
    <Testimonial />
    <Pricing />
    <Footer />
  </main>
);

export default Index;
