import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  copy: string;
  className?: string;
}

export function FeatureCard({
  icon: Icon,
  title,
  copy,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-border bg-muted/10 p-6 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/30',
        className,
      )}
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  );
}
