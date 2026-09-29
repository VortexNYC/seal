import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared settings content shell — one width + gap rhythm for every settings page.
 * Default: form density (max-w-2xl). Wide: tables / two-column (max-w-4xl).
 */
export function SettingsBody({
  children,
  wide = false,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-5",
        wide ? "max-w-4xl" : "max-w-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}
