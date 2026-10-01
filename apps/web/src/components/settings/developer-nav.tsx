import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";

type DeveloperTab = "api-keys" | "webhooks";

/**
 * Shared Developer settings tab strip — API keys / Webhooks stay consistent.
 */
export function DeveloperNav({
  slug,
  active,
}: {
  slug: string;
  active: DeveloperTab;
}): ReactElement {
  return (
    <nav
      aria-label="Developer sections"
      className="border-border flex gap-1 border-b pb-3"
    >
      <DeveloperNavLink
        to="/$slug/settings/developer/api-keys"
        slug={slug}
        active={active === "api-keys"}
      >
        API keys
      </DeveloperNavLink>
      <DeveloperNavLink
        to="/$slug/settings/developer/webhooks"
        slug={slug}
        active={active === "webhooks"}
      >
        Webhooks
      </DeveloperNavLink>
    </nav>
  );
}

function DeveloperNavLink({
  to,
  slug,
  active,
  children,
}: {
  to:
    | "/$slug/settings/developer/api-keys"
    | "/$slug/settings/developer/webhooks";
  slug: string;
  active: boolean;
  children: string;
}): ReactElement {
  return (
    <Link
      to={to}
      params={{ slug }}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
