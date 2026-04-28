import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  highlight?: string;
  subtitle?: string;
  align?: 'left' | 'center';
  invert?: boolean;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  highlight,
  subtitle,
  align = 'center',
  invert = false,
  className,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'max-w-3xl px-2 sm:px-0',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
        className,
      )}
    >
      {eyebrow && (
        <div
          className={cn(
            'mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase',
            invert
              ? 'bg-white/10 text-white/80 border border-white/15'
              : 'bg-primary/10 text-primary border border-primary/15',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', invert ? 'bg-aurora-violet' : 'bg-primary')} />
          {eyebrow}
        </div>
      )}
      <h2
        className={cn(
          'display text-[30px] sm:text-[40px] md:text-5xl lg:text-[56px]',
          invert ? 'text-white' : 'text-foreground',
        )}
      >
        {title}
        {highlight && (
          <>
            {' '}
            <span className="text-gradient">{highlight}</span>
          </>
        )}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'mt-5 text-base sm:text-lg leading-relaxed max-w-2xl',
            align === 'center' && 'mx-auto',
            invert ? 'text-white/65' : 'text-muted-foreground',
          )}
        >
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}
