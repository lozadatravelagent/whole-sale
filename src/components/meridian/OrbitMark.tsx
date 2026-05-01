import * as React from "react";
import { cn } from "@/lib/utils";

interface OrbitMarkProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  animated?: boolean;
  wordmark?: boolean;
  variant?: "violet" | "smoke" | "white";
}

export const OrbitMark = React.forwardRef<HTMLDivElement, OrbitMarkProps>(
  ({ size = 40, animated = false, wordmark = false, variant = "violet", className, ...props }, ref) => {
    const arcStroke =
      variant === "smoke"
        ? "hsl(40 14% 93%)"
        : variant === "white"
          ? "white"
          : "hsl(262 75% 55%)";
    const ringStroke =
      variant === "white" ? "rgba(255,255,255,0.25)" : "hsl(252 38% 72% / 0.18)";
    const dashStroke =
      variant === "white" ? "rgba(255,255,255,0.3)" : "hsl(252 38% 72% / 0.3)";

    const wordmarkColor =
      variant === "smoke"
        ? "hsl(40 14% 93%)"
        : variant === "white"
          ? "white"
          : "hsl(var(--foreground))";

    const containerSize = size;
    const innerSize = size;

    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center", className)}
        style={{ height: containerSize }}
        aria-hidden
        {...props}
      >
        <div
          className="relative shrink-0"
          style={{ width: innerSize, height: innerSize }}
        >
          {/* Outer ring — animated (slow rotate) */}
          <svg
            className={cn("absolute inset-0", animated && "animate-orbit-spin-slow")}
            style={{ opacity: 0.25 }}
            viewBox="0 0 200 200"
            width={innerSize}
            height={innerSize}
          >
            <circle
              cx="100"
              cy="100"
              r="95"
              stroke={arcStroke}
              strokeWidth="1"
              fill="none"
              strokeDasharray="4 8"
            />
          </svg>

          {/* Middle ring — animated (reverse rotate) */}
          <svg
            className={cn(
              "absolute inset-0",
              animated && "animate-orbit-spin"
            )}
            style={{ opacity: 0.18, animationDirection: animated ? "reverse" : undefined }}
            viewBox="0 0 200 200"
            width={innerSize}
            height={innerSize}
          >
            <circle
              cx="100"
              cy="100"
              r="70"
              stroke={ringStroke}
              strokeWidth="1"
              fill="none"
            />
          </svg>

          {/* Main arc (270°) + node */}
          <svg
            className="absolute inset-0"
            viewBox="0 0 200 200"
            width={innerSize}
            height={innerSize}
          >
            <path
              d="M 100 6 A 94 94 0 0 1 194 100 A 94 94 0 0 1 100 194 A 94 94 0 0 0 6 100 A 94 94 0 0 0 100 6"
              stroke={arcStroke}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            {/* Node glow — three layers */}
            <circle cx="194" cy="100" r="14" fill={arcStroke} fillOpacity="0.18" />
            <circle cx="194" cy="100" r="8" fill={arcStroke} fillOpacity="0.32" />
            <circle cx="194" cy="100" r="5" fill={arcStroke} />
          </svg>

          {/* Inner ring — depth */}
          <svg
            className="absolute inset-0"
            style={{ opacity: 0.12 }}
            viewBox="0 0 200 200"
            width={innerSize}
            height={innerSize}
          >
            <circle
              cx="100"
              cy="100"
              r="44"
              stroke={dashStroke}
              strokeWidth="1"
              fill="none"
              strokeDasharray="3 6"
            />
          </svg>
        </div>

        {wordmark && (
          <span
            className="ml-2 italic"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: Math.round(size * 0.55),
              letterSpacing: "-0.025em",
              color: wordmarkColor,
              lineHeight: 1,
            }}
          >
            Emilia
          </span>
        )}
      </div>
    );
  }
);
OrbitMark.displayName = "OrbitMark";
