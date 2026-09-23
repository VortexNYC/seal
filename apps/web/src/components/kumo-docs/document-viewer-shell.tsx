import type { JSX, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Top-level document workspace: optional left thumbnail rail, main viewer,
 * optional right review rail. Extend's viewer chrome — Seal/Kumo owned.
 */
export function DocumentViewerShell({
  className,
  left,
  main,
  right,
}: {
  className?: string;
  left?: ReactNode;
  main: ReactNode;
  right?: ReactNode;
}): JSX.Element {
  return (
    <div
      data-kumo-docs="viewer-shell"
      className={cn(
        "border-border bg-card relative flex min-h-[36rem] overflow-hidden rounded-xl border",
        className
      )}
    >
      {left ? (
        <div className="border-border bg-sidebar hidden w-40 shrink-0 border-r lg:block">
          {left}
        </div>
      ) : null}
      <div className="bg-muted/40 dark:bg-background min-w-0 flex-1">{main}</div>
      {right ? (
        <div className="border-border bg-card hidden w-[22rem] shrink-0 border-l xl:block">
          {right}
        </div>
      ) : null}
    </div>
  );
}
