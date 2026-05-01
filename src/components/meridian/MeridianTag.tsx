import * as React from "react";
import { cn } from "@/lib/utils";

interface MeridianTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "lilac" | "violet" | "muted";
}

/**
 * Eyebrow / tag label per brandbook typography system.
 * Cabinet Grotesk / Space Grotesk fallback, 10px, letter-spacing 0.28em, uppercase.
 */
export const MeridianTag = React.forwardRef<HTMLSpanElement, MeridianTagProps>(
  ({ tone = "lilac", className, children, ...props }, ref) => {
    const colorClass =
      tone === "violet"
        ? "text-primary"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-accent dark:text-accent";

    return (
      <span
        ref={ref}
        className={cn(
          "inline-block font-utility text-[10px] font-bold uppercase",
          "tracking-[0.28em]",
          colorClass,
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
MeridianTag.displayName = "MeridianTag";
