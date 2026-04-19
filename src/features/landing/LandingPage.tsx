import { LandingLayout } from './components/LandingLayout';
import { Hero } from './sections/Hero';
import { Ecosystem } from './sections/Ecosystem';
import { HowItWorks } from './sections/HowItWorks';
import { PromptDemo } from './sections/PromptDemo';
import { HelpsWith } from './sections/HelpsWith';
import { Inspiration } from './sections/Inspiration';
import { Understands } from './sections/Understands';
import { Personalized } from './sections/Personalized';
import { Trust } from './sections/Trust';
import { FinalCta } from './sections/FinalCta';

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
      <Trust />
      <FinalCta />
    </LandingLayout>
  );
}
