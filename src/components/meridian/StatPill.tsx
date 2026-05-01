import * as React from "react";
import { cn } from "@/lib/utils";

interface StatPillProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
}

/**
 * Inline statistic / status pill. Violet/.12 fill, violet/.22 border,
 * Cabinet Grotesk 12px medium per brandbook.
 */
export const StatPill = React.forwardRef<HTMLDivElement, StatPillProps>(
  ({ icon, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-4 py-1.5",
          "bg-primary/[0.12] border-primary/[0.22]",
          "font-utility text-xs font-bold tracking-wide text-primary",
          "transition-all duration-300 ease-out-expo",
          className
        )}
        {...props}
      >
        {icon}
        {children}
      </div>
    );
  }
);
StatPill.displayName = "StatPill";
