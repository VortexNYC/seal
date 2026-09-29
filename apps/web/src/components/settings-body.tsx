import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Settings content — full usable width of the main pane (not a centered postcard).
 * `narrow` keeps long form fields readable; default is product-width.
 */
export function SettingsBody({
  children,
  wide = true,
  narrow = false,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  narrow?: boolean;
  className?: string;
}): ReactElement {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6",
        narrow ? "max-w-2xl" : wide ? "max-w-5xl" : "max-w-3xl",
        className
      )}
    >
      {children}
    </div>
  );
}
