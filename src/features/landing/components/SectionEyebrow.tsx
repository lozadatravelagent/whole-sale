import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionEyebrowProps {
  children: ReactNode;
  className?: string;
}

export function SectionEyebrow({ children, className }: SectionEyebrowProps) {
  return (
    <span
      className={cn(
        'text-[13px] font-semibold uppercase tracking-wider text-primary',
        className,
      )}
    >
      {children}
    </span>
  );
}
