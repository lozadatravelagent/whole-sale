import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-300 ease-out-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-secondary hover:text-secondary-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // === Meridian variants ===
        // Pill CTA with violet gradient + shimmer-on-hover + lift.
        meridian:
          "relative overflow-hidden rounded-full bg-[image:var(--gradient-cta)] text-primary-foreground shadow-cta font-utility font-bold tracking-tight hover:shadow-glow hover:-translate-y-0.5 active:scale-[0.98] before:content-[''] before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:-translate-x-full before:rounded-full hover:before:animate-meridian-shimmer",
        // Glass surface, used on dark backgrounds (chat dock, header actions).
        "meridian-glass":
          "rounded-full meridian-glass text-foreground font-utility font-bold tracking-tight hover:bg-foreground/[0.06] hover:-translate-y-0.5 active:scale-[0.98]",
        // Ghost with violet ring on hover.
        "meridian-ghost":
          "rounded-full bg-transparent text-foreground/80 font-utility font-bold tracking-tight hover:bg-foreground/[0.06] hover:text-foreground active:scale-[0.98]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        // Meridian pill sizes — match brandbook 06.
        "meridian-md": "h-11 px-6 text-sm",
        "meridian-sm": "h-9 px-4 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
