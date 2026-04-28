import { Plane, Briefcase, Network, type LucideIcon } from 'lucide-react';

export interface UseCaseDef {
  id: 'viajeros' | 'agencias' | 'mayoristas';
  icon: LucideIcon;
  titleKey: string;
  taglineKey: string;
  descKey: string;
  forWhoKey: string;
  featureKeys: string[];
  ctaKey: string;
  iconBgClass: string;
  accentClass: string;
}

const FEATURE_COUNTS = { viajeros: 5, agencias: 6, mayoristas: 6 } as const;

const featureKeys = (id: keyof typeof FEATURE_COUNTS) =>
  Array.from({ length: FEATURE_COUNTS[id] }, (_, i) => `useCases.${id}.features.${i}`);

export const USE_CASES: UseCaseDef[] = [
  {
    id: 'viajeros',
    icon: Plane,
    titleKey: 'useCases.viajeros.title',
    taglineKey: 'useCases.viajeros.tagline',
    descKey: 'useCases.viajeros.desc',
    forWhoKey: 'useCases.viajeros.forWho',
    featureKeys: featureKeys('viajeros'),
    ctaKey: 'useCases.viajeros.cta',
    iconBgClass: 'bg-primary/10 text-primary',
    accentClass: 'from-primary/10 to-aurora-blue/15',
  },
  {
    id: 'agencias',
    icon: Briefcase,
    titleKey: 'useCases.agencias.title',
    taglineKey: 'useCases.agencias.tagline',
    descKey: 'useCases.agencias.desc',
    forWhoKey: 'useCases.agencias.forWho',
    featureKeys: featureKeys('agencias'),
    ctaKey: 'useCases.agencias.cta',
    iconBgClass: 'bg-aurora-blue/30 text-[hsl(220_45%_42%)]',
    accentClass: 'from-aurora-blue/15 to-aurora-mint/15',
  },
  {
    id: 'mayoristas',
    icon: Network,
    titleKey: 'useCases.mayoristas.title',
    taglineKey: 'useCases.mayoristas.tagline',
    descKey: 'useCases.mayoristas.desc',
    forWhoKey: 'useCases.mayoristas.forWho',
    featureKeys: featureKeys('mayoristas'),
    ctaKey: 'useCases.mayoristas.cta',
    iconBgClass: 'bg-aurora-coral/40 text-[hsl(14_45%_42%)]',
    accentClass: 'from-aurora-coral/15 to-aurora-pink/15',
  },
];
