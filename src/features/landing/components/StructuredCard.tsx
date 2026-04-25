import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StructuredCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  className?: string;
}

export function StructuredCard({ icon: Icon, label, value, className }: StructuredCardProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border border-border bg-background/60 px-3 py-2.5 backdrop-blur-sm',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="truncate text-sm font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}
