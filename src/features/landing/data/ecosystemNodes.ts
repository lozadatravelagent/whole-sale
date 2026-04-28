import { Plane, Hotel, Sparkles, Briefcase, Network, Database, Globe, Shield, Zap, User, type LucideIcon } from 'lucide-react';

export type OrbitTier = 'inner' | 'outer';

export interface OrbitNodeDef {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  angle: number;
  tier: OrbitTier;
}

export interface OrbitStat {
  id: string;
  k: string;
  vKey: string;
}

export const ORBIT_INNER: OrbitNodeDef[] = [
  { id: 'vuelos', labelKey: 'infraestructura.diagram.inner.vuelos', icon: Plane, angle: 0, tier: 'inner' },
  { id: 'hoteles', labelKey: 'infraestructura.diagram.inner.hoteles', icon: Hotel, angle: 72, tier: 'inner' },
  { id: 'servicios', labelKey: 'infraestructura.diagram.inner.servicios', icon: Sparkles, angle: 144, tier: 'inner' },
  { id: 'agencias', labelKey: 'infraestructura.diagram.inner.agencias', icon: Briefcase, angle: 216, tier: 'inner' },
  { id: 'mayoristas', labelKey: 'infraestructura.diagram.inner.mayoristas', icon: Network, angle: 288, tier: 'inner' },
];

export const ORBIT_OUTER: OrbitNodeDef[] = [
  { id: 'gds', labelKey: 'infraestructura.diagram.outer.gds', icon: Database, angle: 36, tier: 'outer' },
  { id: 'otas', labelKey: 'infraestructura.diagram.outer.otas', icon: Globe, angle: 108, tier: 'outer' },
  { id: 'compliance', labelKey: 'infraestructura.diagram.outer.compliance', icon: Shield, angle: 180, tier: 'outer' },
  { id: 'pagos', labelKey: 'infraestructura.diagram.outer.pagos', icon: Zap, angle: 252, tier: 'outer' },
  { id: 'viajeros', labelKey: 'infraestructura.diagram.outer.viajeros', icon: User, angle: 324, tier: 'outer' },
];

export const ORBIT_STATS: OrbitStat[] = [
  { id: 'providers', k: '+40', vKey: 'infraestructura.stats.providers' },
  { id: 'latency', k: '<2s', vKey: 'infraestructura.stats.latency' },
  { id: 'uptime', k: '24/7', vKey: 'infraestructura.stats.uptime' },
];

export const INNER_RADIUS = 22;
export const OUTER_RADIUS = 38;
