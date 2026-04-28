import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { OrbitNodeDef } from '../../data/ecosystemNodes';
import { polar } from './polar';

interface OrbitNodeProps {
  node: OrbitNodeDef;
  radius: number;
  index: number;
  active: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
}

export function OrbitNode({ node, radius, index, active, dimmed, onHover }: OrbitNodeProps) {
  const { t } = useTranslation('landing');
  const point = polar(node.angle, radius);
  const Icon = node.icon;
  const isInner = node.tier === 'inner';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: (isInner ? 0.5 : 1) + index * (isInner ? 0.1 : 0.08),
        ease: [0.16, 1, 0.3, 1],
      }}
      animate={{ opacity: dimmed ? (isInner ? 0.4 : 0.35) : 1, scale: active ? 1.08 : 1 }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2 z-10 transition-all duration-300',
        node.id === 'mayoristas' && '-ml-14 sm:ml-0',
      )}
      style={{ left: `${point.x}%`, top: `${point.y}%` }}
    >
      <div
        className={cn(
          'flex items-center gap-1 sm:gap-1.5 rounded-full border whitespace-nowrap tracking-tight transition-all duration-300 cursor-default',
          isInner
            ? 'px-2 py-0.5 text-[10px] sm:px-3 sm:py-1.5 sm:text-[12px] font-semibold'
            : 'px-1.5 py-0.5 text-[9px] sm:px-2.5 sm:py-1 sm:text-[11px] font-medium',
          isInner
            ? active
              ? 'bg-primary text-primary-foreground border-primary shadow-glow'
              : 'bg-white border-border shadow-md text-foreground'
            : active
              ? 'bg-white border-primary/50 text-foreground shadow-md'
              : 'bg-white/70 backdrop-blur border-border/60 text-muted-foreground shadow-sm',
        )}
      >
        <Icon
          className={cn(
            isInner ? 'h-2.5 w-2.5 sm:h-3.5 sm:w-3.5' : 'h-2.5 w-2.5 sm:h-3 sm:w-3',
            isInner
              ? active
                ? 'text-primary-foreground'
                : 'text-primary'
              : active
                ? 'text-primary'
                : '',
          )}
          strokeWidth={isInner ? 2.2 : 2}
        />
        {t(node.labelKey)}
      </div>
    </motion.div>
  );
}
