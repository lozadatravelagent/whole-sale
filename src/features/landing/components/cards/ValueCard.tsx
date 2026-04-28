import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValueCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  toneClass: string;
  iconBgClass: string;
  index: number;
}

export function ValueCard({ icon: Icon, title, description, toneClass, iconBgClass, index }: ValueCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-[1.75rem] bg-white border border-border/60 p-7 shadow-sm transition-all duration-500 hover:-translate-y-1.5 hover:shadow-lg overflow-hidden"
    >
      <div
        aria-hidden
        className={cn(
          'absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gradient-to-br opacity-0 blur-3xl group-hover:opacity-50 transition-opacity duration-700',
          toneClass,
        )}
      />
      <div className={cn('relative h-12 w-12 rounded-2xl flex items-center justify-center mb-6', iconBgClass)}>
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <h3 className="relative text-[20px] font-semibold text-foreground leading-snug tracking-tight">
        {title}
      </h3>
      <p className="relative mt-3 text-[15px] text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}
