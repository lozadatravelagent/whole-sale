import { LandingLayout } from './components/LandingLayout';
import { Hero } from './sections/Hero';
import { WhatIsEmilia } from './sections/WhatIsEmilia';
import { RealExample } from './sections/RealExample';
import { HowItWorks } from './sections/HowItWorks';
import { Differentiator } from './sections/Differentiator';
import { TwoModes } from './sections/TwoModes';
import { Solutions } from './sections/Solutions';
import { EcosystemNetwork } from './sections/EcosystemNetwork';
import { Impact } from './sections/Impact';
import { Models } from './sections/Models';
import { AboutVibook } from './sections/AboutVibook';
import { FinalCta } from './sections/FinalCta';

export default function LandingPage() {
  return (
    <LandingLayout>
      <Hero />
      <WhatIsEmilia />
      <RealExample />
      <HowItWorks />
      <Differentiator />
      <TwoModes />
      <Solutions />
      <EcosystemNetwork />
      <Impact />
      <Models />
      <AboutVibook />
      <FinalCta />
    </LandingLayout>
  );
}
