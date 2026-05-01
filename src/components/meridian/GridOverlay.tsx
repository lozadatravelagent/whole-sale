import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Faint architectural grid lines. Use as a structural underlay
 * in hero sections and login surfaces.
 */
export const GridOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden
        className={cn("meridian-grid-overlay", className)}
        {...props}
      />
    );
  }
);
GridOverlay.displayName = "GridOverlay";
