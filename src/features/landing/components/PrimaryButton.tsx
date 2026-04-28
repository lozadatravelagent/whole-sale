import { ButtonHTMLAttributes, forwardRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'md' | 'lg';
  showArrow?: boolean;
  variant?: 'primary' | 'dark';
}

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ className, children, size = 'md', showArrow = true, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]',
        variant === 'primary'
          ? 'gradient-cta text-primary-foreground shadow-cta hover:shadow-glow hover:-translate-y-0.5'
          : 'bg-foreground text-background shadow-md hover:bg-foreground/90 hover:-translate-y-0.5',
        size === 'lg' ? 'h-14 px-8 text-[15px]' : 'h-11 px-6 text-sm',
        className,
      )}
      {...props}
    >
      <span className="absolute inset-0 overflow-hidden rounded-full">
        <span className="absolute inset-y-0 -inset-x-4 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer-x" />
      </span>
      <span className="relative z-10">{children}</span>
      {showArrow && (
        <ArrowRight className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
      )}
    </button>
  ),
);
PrimaryButton.displayName = 'PrimaryButton';
