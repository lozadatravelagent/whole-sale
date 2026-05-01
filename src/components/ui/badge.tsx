import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // === Meridian variants — Cabinet/Space Grotesk, uppercase, tracked ===
        tag: "border-primary/[0.22] bg-primary/[0.1] text-primary font-utility font-bold uppercase tracking-[0.08em] text-[11px] px-3.5",
        success:
          "border-success/30 bg-success/10 text-success font-utility font-bold uppercase tracking-[0.08em] text-[11px] px-3.5",
        warning:
          "border-warning/30 bg-warning/10 text-warning font-utility font-bold uppercase tracking-[0.08em] text-[11px] px-3.5",
        beta:
          "border-accent/30 bg-accent/10 text-accent font-utility font-bold uppercase tracking-[0.08em] text-[11px] px-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
