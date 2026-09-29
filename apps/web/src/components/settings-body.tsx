import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Settings content — full usable width of the main pane (not a centered postcard).
 * `narrow` keeps long form fields readable. Auth UI cards are un-centered via
 * the seal-settings-auth scope (better-auth-ui AuthCard defaults to max-w-md).
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
        "seal-settings-auth flex w-full flex-col gap-6",
        // Kill AuthCard postcard: mx-auto max-w-md + centered headers.
        "[&_section]:mx-0 [&_section]:w-full [&_section]:max-w-none",
        "[&_section]:shadow-none",
        "[&_section>header]:text-left",
        narrow ? "max-w-2xl" : wide ? "max-w-none" : "max-w-3xl",
        className
      )}
    >
      {children}
    </div>
  );
}
