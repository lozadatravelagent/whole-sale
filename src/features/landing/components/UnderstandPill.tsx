import { cn } from '@/lib/utils';

interface UnderstandPillProps {
  label: string;
  className?: string;
}

export function UnderstandPill({ label, className }: UnderstandPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  );
}
