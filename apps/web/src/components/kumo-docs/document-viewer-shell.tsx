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
        "border-border bg-background relative flex h-full min-h-0 flex-1 overflow-hidden rounded-xl border",
        className
      )}
    >
      {left ? (
        <div className="border-border bg-background hidden w-40 shrink-0 overflow-y-auto border-r lg:block">
          {left}
        </div>
      ) : null}
      <div className="bg-background min-h-0 min-w-0 flex-1 overflow-auto">
        {main}
      </div>
      {right ? (
        <div className="border-border bg-background hidden w-88 shrink-0 border-l xl:block">
          {right}
        </div>
      ) : null}
    </div>
  );
}
