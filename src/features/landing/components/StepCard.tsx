import { motion, type Transition } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepCardProps {
  number: string;
  icon: LucideIcon;
  title: string;
  copy: string;
  className?: string;
}

type IconAnim = {
  initial: Record<string, unknown>;
  whileInView: Record<string, unknown>;
  transition: Transition;
};

// Icon animation variant chosen by step number. Coupled intentionally to
// the "01"/"02"/"03" strings from HowItWorks.STEP_META — these are fixed
// by the brief (three steps, that order) and carry semantic meaning for
// each animation. If the step ordering ever changes, this switch is the
// one place to update alongside STEP_META and the i18n copy.
function getIconAnim(number: string): IconAnim | null {
  switch (number) {
    case '01':
      // Sparkles: scale-in with a full rotation, spring bounce.
      return {
        initial: { scale: 0, rotate: 0 },
        whileInView: { scale: 1, rotate: 360 },
        transition: { duration: 0.6, type: 'spring', bounce: 0.45 },
      };
    case '02':
      // MessagesSquare: fade + scale. Downgraded from the plan's "draw-in"
      // because draw-in would require copying the lucide SVG path into
      // our component to manipulate stroke-dashoffset, which is too much
      // coupling for a decorative icon. The fade+scale preserves the
      // "appearing / being written" intent at near-zero complexity.
      return {
        initial: { opacity: 0, scale: 0.7 },
        whileInView: { opacity: 1, scale: 1 },
        transition: { duration: 0.6, ease: 'easeOut' },
      };
    case '03':
      // Compass: directional pulse rotation 0 -> 45 -> 0.
      return {
        initial: { rotate: 0 },
        whileInView: { rotate: [0, 45, 0] },
        transition: { duration: 0.6, ease: 'easeOut' },
      };
    default:
      return null;
  }
}

export function StepCard({
  number,
  icon: Icon,
  title,
  copy,
  className,
}: StepCardProps) {
  const anim = getIconAnim(number);

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-border bg-card p-8 shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-5xl font-semibold leading-none tracking-tight text-primary/30">
          {number}
        </span>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {anim ? (
            <motion.span
              initial={anim.initial}
              whileInView={anim.whileInView}
              viewport={{ once: true, amount: 0.5 }}
              transition={anim.transition}
              className="inline-flex items-center justify-center"
            >
              <Icon className="h-5 w-5" />
            </motion.span>
          ) : (
            <Icon className="h-5 w-5" />
          )}
        </span>
      </div>
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="text-base leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  );
}
