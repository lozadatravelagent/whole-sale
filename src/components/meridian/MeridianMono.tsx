import * as React from "react";
import { cn } from "@/lib/utils";

interface MeridianMonoProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "xs" | "sm" | "md";
}

/**
 * Technical / data label (DM Mono). Used for IDs, codes, timestamps,
 * spec rows. Tracks 0.1em per brandbook.
 */
export const MeridianMono = React.forwardRef<HTMLSpanElement, MeridianMonoProps>(
  ({ size = "sm", className, children, ...props }, ref) => {
    const sizeClass = size === "xs" ? "text-[10px]" : size === "md" ? "text-sm" : "text-xs";
    return (
      <span
        ref={ref}
        className={cn(
          "font-mono tracking-[0.1em]",
          sizeClass,
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
MeridianMono.displayName = "MeridianMono";
