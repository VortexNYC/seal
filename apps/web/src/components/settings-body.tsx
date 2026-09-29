import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared settings content shell — one width + gap rhythm for every settings page.
 * Uses Tailwind scale tokens only (max-w-2xl / max-w-4xl). Layout via flex+gap,
 * never space-y — matches Kumo/shadcn spacing guidance.
 */
export function SettingsBody({
  children,
  wide = false,
  className,
}: {
  children: ReactNode;
  wide?: boolean;
  className?: string;
}): ReactElement {
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
