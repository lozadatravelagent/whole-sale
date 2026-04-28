import { Zap, Layers, TrendingUp, type LucideIcon } from 'lucide-react';

export interface CoreValueItem {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  toneClass: string;
  iconBgClass: string;
}

export const CORE_VALUE_ITEMS: CoreValueItem[] = [
  {
    id: 'speed',
    icon: Zap,
    titleKey: 'coreValue.items.speed.title',
    descKey: 'coreValue.items.speed.desc',
    toneClass: 'from-aurora-violet to-aurora-pink',
    iconBgClass: 'bg-aurora-violet/30 text-primary',
  },
  {
    id: 'structure',
    icon: Layers,
    titleKey: 'coreValue.items.structure.title',
    descKey: 'coreValue.items.structure.desc',
    toneClass: 'from-aurora-blue to-aurora-mint',
    iconBgClass: 'bg-aurora-blue/40 text-[hsl(205_80%_40%)]',
  },
  {
    id: 'conversion',
    icon: TrendingUp,
    titleKey: 'coreValue.items.conversion.title',
    descKey: 'coreValue.items.conversion.desc',
    toneClass: 'from-aurora-coral to-aurora-pink',
    iconBgClass: 'bg-aurora-coral/40 text-[hsl(8_70%_45%)]',
  },
];
