import * as React from "react";
import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3" | "h4";
type HeadingSize = "display" | "lg" | "md" | "sm";

interface MeridianHeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  size?: HeadingSize;
  gradient?: boolean;
  italic?: boolean;
}

const SIZE_CLASSES: Record<HeadingSize, string> = {
  display: "text-5xl md:text-7xl lg:text-[clamp(56px,8vw,100px)] leading-[0.92]",
  lg: "text-4xl md:text-5xl lg:text-6xl leading-[0.97]",
  md: "text-2xl md:text-3xl lg:text-4xl leading-tight",
  sm: "text-xl md:text-2xl leading-tight",
};

export const MeridianHeading = React.forwardRef<HTMLHeadingElement, MeridianHeadingProps>(
  (
    {
      as = "h2",
      size = "md",
      gradient = false,
      italic = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const Tag = as as React.ElementType;

    return (
      <Tag
        ref={ref}
        className={cn(
          "font-display tracking-[-0.025em]",
          italic && "italic",
          gradient && "meridian-text-gradient",
          SIZE_CLASSES[size],
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);
MeridianHeading.displayName = "MeridianHeading";
