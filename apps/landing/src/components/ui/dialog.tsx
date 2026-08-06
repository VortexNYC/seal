import {
  cn,
  Dialog,
  DialogClose,
  DialogContent as CoreDialogContent,
  DialogHeader as CoreDialogHeader,
  DialogTitle as CoreDialogTitle,
  DialogTrigger,
} from "@vortexnyc/ui";
import type { ComponentProps } from "react";

/**
 * Marketing adapter over `@vortexnyc/ui`'s Dialog (SEA-610).
 *
 * Landing's legal modals are wider and softer than Core's operational dialog:
 * rounded-2xl, p-8, max-w-2xl, scrollable body, serif title. Overrides are
 * appended after Core's classes so tailwind-merge resolves them in landing's
 * favor. The overlay scrim (Core renders it inside DialogContent with no
 * className seam) is restyled via the `[data-slot="dialog-overlay"]` rule in
 * app/globals.css.
 */
function DialogContent({
  className,
  ...props
}: ComponentProps<typeof CoreDialogContent>) {
  return (
    <CoreDialogContent
      className={cn(
        "max-h-[85vh] max-w-2xl overflow-y-auto rounded-2xl p-8 shadow-xl sm:max-w-2xl",
        className
      )}
      {...props}
    />
  );
}

function DialogHeader({
  className,
  ...props
}: ComponentProps<typeof CoreDialogHeader>) {
  return (
    <CoreDialogHeader
      className={cn("gap-1.5 text-left", className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof CoreDialogTitle>) {
  return (
    <CoreDialogTitle
      className={cn(
        "text-foreground font-serif text-2xl leading-8 font-normal tracking-tight",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
