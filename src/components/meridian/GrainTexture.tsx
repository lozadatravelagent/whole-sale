import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Subtle film-grain noise overlay. Apply inside a `position: relative` parent.
 * Adds a layer of analog warmth to dark surfaces.
 */
export const GrainTexture = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        aria-hidden
        className={cn("absolute inset-0 pointer-events-none meridian-grain", className)}
        {...props}
      />
    );
  }
);
GrainTexture.displayName = "GrainTexture";
