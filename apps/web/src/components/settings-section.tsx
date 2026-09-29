import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Flat settings block — one border, title + body. Not a LayerCard stack.
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
  icon,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}): ReactElement {
  return (
    <section
      className={cn(
        "border-border bg-card flex flex-col gap-4 rounded-xl border p-5",
        className
      )}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-foreground m-0 flex items-center gap-2 text-base font-semibold tracking-tight">
          {icon}
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground m-0 text-sm text-pretty">
            {description}
          </p>
        ) : null}
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
