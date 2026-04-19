import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PersonalizationPointProps {
  icon: LucideIcon;
  label: string;
  caption: string;
  className?: string;
}

export function PersonalizationPoint({
  icon: Icon,
  label,
  caption,
  className,
}: PersonalizationPointProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <motion.span
        initial={{ scale: 1 }}
        whileInView={{ scale: [1, 1.1, 1] }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <Icon className="h-5 w-5" />
      </motion.span>
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {label}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  );
}
