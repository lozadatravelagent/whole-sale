import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepCardProps {
  number: string;
  icon: LucideIcon;
  title: string;
  copy: string;
  className?: string;
}

export function StepCard({
  number,
  icon: Icon,
  title,
  copy,
  className,
}: StepCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-2xl border border-border bg-muted/10 p-8 shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-5xl font-semibold leading-none tracking-tight text-primary/30">
          {number}
        </span>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="text-base leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  );
}
