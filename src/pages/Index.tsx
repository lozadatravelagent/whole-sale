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
    {/* Travel background image */}
    <div
      className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1920&q=80')" }}
    />
    {/* Dark overlay for readability */}
    <div className="fixed inset-0 z-0 pointer-events-none bg-[#0a0a0f]/85" />

    {/* Page content */}
    <div className="relative z-10">
      <CursorGlow />
      <Navigation />
      <PublicChat />
      <AboutUs />
      <Features />
      <Showcase />
      <Testimonial />
      <Pricing />
      <Footer />
    </div>
  </main>
);

export default Index;
