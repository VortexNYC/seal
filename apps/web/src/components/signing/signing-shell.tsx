import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SigningShellProps {
  title: string;
  instruction?: string;
  document: ReactNode;
  /** Single sticky signing widget (Documenso shape) */
  widget: ReactNode;
  headerActions?: ReactNode;
  /** iframe embed (?embed=true) — host supplies outer chrome */
  embedded?: boolean;
  className?: string;
}

/**
 * Documenso-shaped signing layout: PDF hero + one sticky widget.
 * Mobile: widget docks to the bottom.
 */
export function SigningShell({
  title,
  instruction,
  document,
  widget,
  headerActions,
  embedded = false,
  className,
}: SigningShellProps): JSX.Element {
  return (
    <div
      data-seal-enter
      className={cn(
        "bg-background mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col sm:px-6",
        embedded && "max-w-none sm:px-3",
        className
      )}
    >
      {embedded ? (
        <div className="mt-2 flex min-w-0 items-baseline gap-x-2 px-3 sm:px-0">
          <h1 className="truncate text-sm font-medium" title={title}>
            {title}
          </h1>
          {instruction ? (
            <p className="text-muted-foreground truncate text-xs">
              {instruction}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-y-2 px-4 sm:mt-6 sm:px-0">
          <div className="max-w-[50ch] min-w-0">
            <h1
              className="truncate text-2xl font-semibold md:text-3xl"
              title={title}
            >
              {title}
            </h1>
            {instruction ? (
              <p className="text-muted-foreground mt-1.5 text-sm">
                {instruction}
              </p>
            ) : null}
          </div>
          {headerActions ? (
            <div className="flex items-center gap-x-3">{headerActions}</div>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          "relative mt-4 flex w-full flex-1 flex-col gap-x-6 gap-y-8 px-4 pb-36 sm:px-0 md:flex-row md:pb-8 lg:gap-x-8",
          embedded ? "mt-3 px-3 pb-32 md:px-0" : "sm:mt-8"
        )}
      >
        <div className="min-w-0 flex-1">{document}</div>
        <div className="fixed right-0 bottom-0 left-0 z-50 w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:sticky md:top-4 md:bottom-auto md:z-auto md:w-[min(100%,22rem)] md:shrink-0 md:self-start md:px-0 md:pb-0">
          <div className="border-border bg-background flex w-full flex-col rounded-xl border px-4 py-4 shadow-sm transition-[box-shadow,transform] duration-200 md:py-6">
            {widget}
          </div>
        </div>
      </div>
    </div>
  );
}
