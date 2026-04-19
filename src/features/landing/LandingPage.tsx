import { LandingLayout } from './components/LandingLayout';
import { Hero } from './sections/Hero';
import { Ecosystem } from './sections/Ecosystem';
import { HowItWorks } from './sections/HowItWorks';
import { PromptDemo } from './sections/PromptDemo';
import { HelpsWith } from './sections/HelpsWith';
import { Inspiration } from './sections/Inspiration';
import { Understands } from './sections/Understands';
import { Personalized } from './sections/Personalized';

const SECTION_STUBS = [
  { id: 'trust', name: 'Trust' },
  { id: 'final-cta', name: 'Final CTA' },
] as const;

export default function LandingPage() {
  return (
    <LandingLayout>
      <Hero />
      <Ecosystem />
      <HowItWorks />
      <PromptDemo />
      <HelpsWith />
      <Inspiration />
      <Understands />
      <Personalized />
      {SECTION_STUBS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-heading`}
          className="scroll-mt-20 py-24 lg:py-32"
        >
          <div className="container mx-auto px-6 lg:px-8">
            <h2
              id={`${section.id}-heading`}
              className="text-2xl font-semibold text-muted-foreground"
            >
              {section.name}
            </h2>
          </div>
        </section>
      ))}
    </LandingLayout>
  );
}
