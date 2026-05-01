import * as React from "react";
import { cn } from "@/lib/utils";

interface AuroraBackdropProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: "subtle" | "full";
  withGrid?: boolean;
  withGrain?: boolean;
}

/**
 * Atmospheric layer for Meridian surfaces.
 *
 * - Renders three drifting aurora orbs (violet / cobalt / lilac).
 * - Optional grid overlay and grain texture.
 * - `intensity="subtle"` lowers orb opacity for surfaces where content
 *   reads dense (planner workspace background).
 *
 * Place inside a `position: relative` parent and set parent `overflow: hidden`.
 */
export const AuroraBackdrop = React.forwardRef<HTMLDivElement, AuroraBackdropProps>(
  ({ intensity = "full", withGrid = false, withGrain = false, className, ...props }, ref) => {
    const subtle = intensity === "subtle";
    const o1 = subtle ? 0.12 : 0.22;
    const o2 = subtle ? 0.08 : 0.14;
    const o3 = subtle ? 0.06 : 0.1;

    return (
      <div
        ref={ref}
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden",
          className
        )}
        {...props}
      >
        {/* Orb 1 — top center, primary violet */}
        <div
          className="absolute animate-aurora-drift will-change-transform"
          style={{
            width: 600,
            height: 500,
            top: -120,
            left: "50%",
            transform: "translateX(-50%)",
            background: `radial-gradient(circle, hsl(var(--primary) / ${o1}), transparent 70%)`,
            filter: "blur(40px)",
          }}
        />
        {/* Orb 2 — left middle, cobalt */}
        <div
          className="absolute animate-aurora-drift-slow will-change-transform"
          style={{
            width: 400,
            height: 400,
            left: "-10%",
            top: "40%",
            background: `radial-gradient(circle, hsl(var(--aurora-blue) / ${o2}), transparent 70%)`,
            filter: "blur(30px)",
          }}
        />
        {/* Orb 3 — right top, lilac */}
        <div
          className="absolute animate-aurora-drift will-change-transform"
          style={{
            width: 350,
            height: 350,
            right: "-5%",
            top: "20%",
            background: `radial-gradient(circle, hsl(var(--accent) / ${o3}), transparent 70%)`,
            filter: "blur(35px)",
            animationDirection: "reverse",
            animationDuration: "30s",
          }}
        />

        {withGrid && <div className="meridian-grid-overlay" />}
        {withGrain && <div className="absolute inset-0 meridian-grain" />}
      </div>
    );
  }
);
AuroraBackdrop.displayName = "AuroraBackdrop";
