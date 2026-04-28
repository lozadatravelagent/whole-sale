import { LandingLayout } from './components/LandingLayout';
import { Hero } from './sections/Hero';
import { CoreValue } from './sections/CoreValue';
import { Diferencial } from './sections/Diferencial';
import { UseCases } from './sections/UseCases';
import { Infraestructura } from './sections/Infraestructura';
import { About } from './sections/About';
import { CtaFinal } from './sections/CtaFinal';

export default function LandingPage() {
  return (
    <LandingLayout>
      <Hero />
      <CoreValue />
      <Diferencial />
      <UseCases />
      <Infraestructura />
      <About />
      <CtaFinal />
    </LandingLayout>
  );
}
