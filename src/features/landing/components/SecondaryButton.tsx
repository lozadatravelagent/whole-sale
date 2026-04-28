import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const SecondaryButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-6 text-sm font-semibold tracking-tight text-foreground transition-all duration-300 glass hover:bg-white/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
SecondaryButton.displayName = 'SecondaryButton';
