import { Badge as CoreBadge, cn } from "@vortexnyc/ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

/**
 * Marketing-scale adapter over `@vortexnyc/ui`'s Badge (SEA-610).
 *
 * Landing's badge is larger and heavier (rounded-md, px-2.5, text-xs,
 * font-semibold) than Core's dense operational pill. The local cva is appended
 * after Core's classes so tailwind-merge resolves conflicts in landing's
 * favor; `gap-0` and `leading-4` neutralize Core's `gap-1`/`leading-none`,
 * preserving the icon spacing (mr-1) and line-height landing shipped with.
 */
const badgeVariants = cva(
  "focus:ring-ring inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-transparent shadow",
        secondary: "bg-secondary text-secondary-foreground border-transparent",
        destructive:
          "bg-destructive text-primary-foreground border-transparent shadow",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <CoreBadge
      className={cn("gap-0 leading-4", badgeVariants({ variant }), className)}
      variant="outline"
      {...props}
    />
  );
}

export { Badge, badgeVariants };
