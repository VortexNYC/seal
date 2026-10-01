"use client";

import { Moon, Sun } from "@phosphor-icons/react";

import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { useTheme } from "@/components/theme-provider";
import { useOptionalWorkspaceShell } from "@/components/workspace-shell-context";

/**
 * Top-right chrome: notifications + theme. Lives in the page header, not the
 * sidebar footer — matches how humans actually look for these controls.
 */
export function ShellHeaderControls(): React.JSX.Element | null {
  const shell = useOptionalWorkspaceShell();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (shell === null) {
    return null;
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <NotificationsPopover slug={shell.slug} organizationSlug={shell.slug} />
      <button
        type="button"
        className="text-foreground hover:bg-accent inline-flex size-8 items-center justify-center rounded-lg"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-pressed={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </button>
    </div>
  );
}
