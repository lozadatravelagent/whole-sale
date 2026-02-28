import { Navigation } from '@/features/landing/components/Navigation';
import { PublicChat } from '@/features/public-chat/PublicChat';
import { Features } from '@/features/landing/components/Features';
import { Showcase } from '@/features/landing/components/Showcase';
import { Testimonial } from '@/features/landing/components/Testimonial';
import { Pricing } from '@/features/landing/components/Pricing';
import { Footer } from '@/features/landing/components/Footer';
import { CursorGlow } from '@/features/landing/components/CursorGlow';
import { LandingHero3D } from '@/features/landing/components/LandingHero3D';
import { LandingScrollProgress } from '@/features/landing/components/LandingScrollProgress';
import { LandingSceneBackground } from '@/features/landing/components/LandingSceneBackground';

const Index = () => (
  <main className="landing-shell relative min-h-screen overflow-x-clip bg-[#040814]">
    <LandingSceneBackground />
    <div className="relative z-10">
      <LandingScrollProgress />
      <CursorGlow />
      <Navigation />
      <LandingHero3D />
      <PublicChat />
      <Features />
      <Showcase />
      <Testimonial />
      <Pricing />
      <Footer />
    </div>
  </main>
);

export default Index;
