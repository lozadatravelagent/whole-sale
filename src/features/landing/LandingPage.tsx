import { LandingLayout } from './components/LandingLayout';
import { Hero } from './sections/Hero';
import { Ecosystem } from './sections/Ecosystem';

const SECTION_STUBS = [
  { id: 'how-it-works', name: 'How it works' },
  { id: 'prompt-demo', name: 'Prompt demo' },
  { id: 'helps-with', name: 'Helps with' },
  { id: 'inspiration', name: 'Inspiration' },
  { id: 'understands', name: 'Understands' },
  { id: 'personalized', name: 'Personalized' },
  { id: 'trust', name: 'Trust' },
  { id: 'final-cta', name: 'Final CTA' },
] as const;

export default function LandingPage() {
  return (
    <LandingLayout>
      <Hero />
      <Ecosystem />
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
