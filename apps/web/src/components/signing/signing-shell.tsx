import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SigningShellProps {
  title: string;
  instruction?: string;
  document: ReactNode;
  /** Single sticky signing widget (Documenso shape) */
  widget: ReactNode;
  headerActions?: ReactNode;
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
  className,
}: SigningShellProps): JSX.Element {
  return (
    <div
      className={cn(
        "bg-background mx-auto flex min-h-dvh w-full max-w-screen-xl flex-col sm:px-6",
        className
      )}
    >
      <div className="mt-4 flex flex-wrap items-start justify-between gap-y-2 px-4 sm:mt-6 sm:px-0">
        <div className="min-w-0 max-w-[50ch]">
          <h1
            className="truncate text-2xl font-semibold md:text-3xl"
            title={title}
          >
            {title}
          </h1>
          {instruction ? (
            <p className="text-muted-foreground mt-1.5 text-sm">{instruction}</p>
          ) : null}
        </div>
        {headerActions ? (
          <div className="flex items-center gap-x-3">{headerActions}</div>
        ) : null}
      </div>

      <div className="relative mt-4 flex w-full flex-1 flex-col gap-x-6 gap-y-8 px-4 pb-36 sm:mt-8 sm:px-0 md:flex-row md:pb-8 lg:gap-x-8">
        <div className="min-w-0 flex-1">{document}</div>
        <div className="fixed right-0 bottom-0 left-0 z-50 w-full px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:sticky md:top-4 md:bottom-auto md:z-auto md:w-[min(100%,22rem)] md:shrink-0 md:self-start md:px-0 md:pb-0">
          <div className="border-border bg-background flex w-full flex-col rounded-xl border px-4 py-4 shadow-sm md:py-6">
            {widget}
          </div>
        </div>
      </div>
    </div>
  );
}
