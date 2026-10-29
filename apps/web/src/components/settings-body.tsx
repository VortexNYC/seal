import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Settings stack inside PageWrapper. Width belongs to the wrapper.
 * Auth cards from better-auth-ui default to a centered max-w-md; flatten them.
 */
export function SettingsBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      className={cn(
        "seal-settings-auth flex w-full flex-col gap-6",
        "[&_section]:mx-0 [&_section]:w-full [&_section]:max-w-none",
        "[&_section]:shadow-none",
        "[&_section>header]:text-left",
        className
      )}
    >
      {children}
    </div>
  );
}
