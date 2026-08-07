import { Button as CoreButton, cn } from "@vortexnyc/ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

/**
 * Marketing-scale adapter over `@vortexnyc/ui`'s Button (SEA-610).
 *
 * Landing keeps its own size/shadow scale — larger touch targets and shadowed
 * variants for the marketing site vs Core's compact operational density. The
 * local cva below is appended after Core's classes, so tailwind-merge resolves
 * every conflict in landing's favor. Core `size` is pinned to "lg" because it
 * is the only Core size without `has-[>svg]` padding rules, which would leak
 * into landing's icon-bearing CTA buttons.
 */
const buttonVariants = cva(
  "focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
        destructive:
          "bg-destructive hover:bg-destructive/90 text-primary-foreground shadow-sm",
        outline:
          "border-input bg-background hover:bg-accent hover:text-accent-foreground border shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  return (
    <CoreButton
      asChild={asChild}
      className={cn(buttonVariants({ variant, size }), className)}
      size="lg"
      variant={variant}
      {...props}
    />
  );
}

export { Button, buttonVariants };
