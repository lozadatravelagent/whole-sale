import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ORBIT_INNER, ORBIT_OUTER, INNER_RADIUS, OUTER_RADIUS } from '../../data/ecosystemNodes';
import { OrbitConnections } from './OrbitConnections';
import { OrbitPulses } from './OrbitPulses';
import { OrbitNode } from './OrbitNode';
import { OrbitCenter } from './OrbitCenter';

export function OrbitDiagram() {
  const { t } = useTranslation('landing');
  const [hoverId, setHoverId] = useState<string | null>(null);

  return (
    <div
      className="relative aspect-square sm:aspect-[16/12] md:aspect-[16/10] rounded-[2rem] sm:rounded-[2.5rem] glass-strong overflow-hidden"
      role="img"
      aria-label={t('infraestructura.diagram.ariaLabel')}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="orbit-line-inner" x1="0" x2="1">
            <stop offset="0%" stopColor="hsl(252 38% 56%)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="hsl(220 40% 60%)" stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="orbit-line-outer" x1="0" x2="1">
            <stop offset="0%" stopColor="hsl(252 38% 65%)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="hsl(220 40% 60%)" stopOpacity={0.18} />
          </linearGradient>
          <linearGradient id="orbit-line-active" x1="0" x2="1">
            <stop offset="0%" stopColor="hsl(252 60% 55%)" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(258 65% 65%)" stopOpacity={0.9} />
          </linearGradient>
          <radialGradient id="orbit-center-glow">
            <stop offset="0%" stopColor="hsl(252 60% 70%)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="hsl(252 60% 70%)" stopOpacity={0} />
          </radialGradient>
        </defs>

        <circle cx={50} cy={50} r={22} fill="none" stroke="hsl(var(--foreground))" strokeOpacity={0.08} strokeWidth={0.15} strokeDasharray="0.5 0.5" />
        <circle cx={50} cy={50} r={38} fill="none" stroke="hsl(var(--foreground))" strokeOpacity={0.06} strokeWidth={0.15} strokeDasharray="0.5 0.5" />
        <circle cx={50} cy={50} r={18} fill="url(#orbit-center-glow)" />

        <OrbitConnections hoverId={hoverId} />
        <OrbitPulses />
      </svg>

      <OrbitCenter />

      {ORBIT_INNER.map((node, i) => (
        <OrbitNode
          key={node.id}
          node={node}
          radius={INNER_RADIUS}
          index={i}
          active={hoverId === node.id}
          dimmed={hoverId !== null && hoverId !== node.id}
          onHover={setHoverId}
        />
      ))}

      {ORBIT_OUTER.map((node, i) => (
        <OrbitNode
          key={node.id}
          node={node}
          radius={OUTER_RADIUS}
          index={i}
          active={hoverId === node.id}
          dimmed={hoverId !== null && hoverId !== node.id}
          onHover={setHoverId}
        />
      ))}

      <div className="absolute top-3 left-3 sm:top-5 sm:left-5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-muted-foreground/70">
        {t('infraestructura.diagram.intelligenceLayer')}
      </div>
      <div className="absolute top-3 right-3 sm:top-5 sm:right-5 flex items-center gap-1 sm:gap-1.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {t('infraestructura.diagram.live')}
      </div>
    </div>
  );
}
