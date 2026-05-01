import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3;
  asChild?: boolean;
}

/**
 * Glassmorphic surface — three depth levels per Meridian brandbook 05.
 *  - level 1: cards, side panels (default)
 *  - level 2: modals, hero surfaces
 *  - level 3: tooltips, overlays on dark backgrounds
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ level = 1, className, ...props }, ref) => {
    const surface =
      level === 2
        ? "meridian-glass-strong"
        : level === 3
          ? "meridian-glass-dark"
          : "meridian-glass";

    return (
      <div
        ref={ref}
        className={cn(
          surface,
          "rounded-3xl",
          "transition-all duration-300 ease-out-expo",
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";
