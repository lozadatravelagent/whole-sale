import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/features/landing/components/Navigation';
import { Hero } from '@/features/landing/components/Hero';
import { Features } from '@/features/landing/components/Features';
import { HowItWorks } from '@/features/landing/components/HowItWorks';
import { Scale } from '@/features/landing/components/Scale';
import { Results } from '@/features/landing/components/Results';
import { Pricing } from '@/features/landing/components/Pricing';
import { CRM } from '@/features/landing/components/CRM';
import { FeaturesBadges } from '@/features/landing/components/FeaturesBadges';
import { Contact } from '@/features/landing/components/Contact';
import { FAQ } from '@/features/landing/components/FAQ';
import { Footer } from '@/features/landing/components/Footer';
import { Divider } from '@/features/landing/components/Divider';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = false;
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Skip to content - Accessibility */}
      <a
        href="#inicio"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Saltar al contenido
      </a>

      <Navigation onNavigate={scrollToSection} />

      <main>
        <Hero />

        <Features />

        <Divider />

        <HowItWorks />

        <Divider />

        <Scale />

        <Divider />

        <Results />

        <Divider />

        <Pricing />

        <Divider />

        <CRM />

        <Divider />

        <FeaturesBadges />

        <Divider />

        <Contact />

        <Divider />

        <FAQ onNavigateToContact={() => scrollToSection('contacto')} />
      </main>

      <Footer onNavigate={scrollToSection} />
    </div>
  );
};

export default Index;
