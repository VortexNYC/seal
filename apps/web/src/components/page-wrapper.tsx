import { Text } from "@cloudflare/kumo/components/text";
import { Button } from "@cloudflare/kumo/components/button";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { type Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { ShellHeaderControls } from "@/components/shell-header-controls";
import { MOTION_PAGE } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface PageAction {
  label: string;
  onClick: () => void;
  icon?: Icon;
  variant?: "default" | "outline" | "ghost" | "destructive";
  disabled?: boolean;
}

interface PageWrapperProps {
  children: ReactNode;
  title: string;
  description?: string;
  action?: PageAction;
  actions?: PageAction[];
  /** SEA-132: Custom header actions (e.g., export dialog) */
  headerActions?: ReactNode;
  /** Optional centered header content shown between the title block and actions */
  headerCenter?: ReactNode;
  /** Optional extra classes applied to the outermost container (affects header + content) */
  className?: string;
  /** Document editor: the canvas fills the pane, with no reading column. */
  dense?: boolean;
  /** Data grids that need the full pane. Header and body stay full width. */
  bleed?: boolean;
}

export function PageWrapper({
  children,
  title,
  description,
  action,
  actions,
  headerActions,
  headerCenter,
  className,
  dense = false,
  bleed = false,
}: PageWrapperProps) {
  const allActions = action ? [action, ...(actions || [])] : actions || [];

  return (
    <div
      className={cn(
        "bg-kumo-canvas flex h-full min-h-0 flex-col overscroll-contain",
        /* Cap: document editor — page itself must not scroll into empty void */
        dense
          ? "scroll-pb-0 overflow-hidden"
          : "scroll-pb-24 overflow-auto sm:scroll-pb-28",
        className
      )}
    >
      <div className="bg-kumo-canvas/95 border-kumo-line sticky top-0 z-10 border-b backdrop-blur-sm">
        <div
          className={cn(
            "mx-auto flex min-h-16 w-full flex-col gap-3 px-4 py-3 sm:px-6",
            !dense && !bleed && "max-w-6xl",
            headerCenter
              ? "lg:grid-cols-center lg:grid lg:items-center lg:gap-4"
              : "sm:flex-row sm:items-center sm:gap-4 sm:py-0"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center gap-3",
              headerCenter ? "lg:min-w-0" : "flex-1"
            )}
          >
            {/* Collapse lives outside the sidebar so it stays clickable. */}
            <Sidebar.Trigger
              aria-label="Toggle navigation"
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <Text as="h1" variant="heading" truncate>{title}</Text>
              {description && (
                <Text as="p" variant="secondary" size="xs" truncate>{description}</Text>
              )}
            </div>
          </div>
          {headerCenter && (
            <div className="min-w-0 lg:justify-self-center">{headerCenter}</div>
          )}
          <div
            className={cn(
              "flex flex-wrap items-center gap-2",
              headerCenter
                ? "lg:justify-end lg:justify-self-end"
                : "sm:ml-auto sm:flex-nowrap"
            )}
          >
            {headerActions}
            {allActions.map((actionItem, index) => {
              const Icon = actionItem.icon;
              const variant =
                actionItem.variant === "default"
                  ? "primary"
                  : actionItem.variant;
              return (
                <Button
                  key={index}
                  onClick={actionItem.onClick}
                  variant={variant}
                  size="sm"
                  className="flex-1 sm:flex-none"
                  disabled={actionItem.disabled}
                  icon={Icon}
                >
                  <span className="truncate">{actionItem.label}</span>
                </Button>
              );
            })}
            <ShellHeaderControls />
          </div>
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          dense
            ? "flex flex-col overflow-hidden p-3 sm:p-4"
            : "pt-4 pb-12 sm:pt-6 sm:pb-16",
          MOTION_PAGE
        )}
      >
        {dense ? (
          children
        ) : (
          <div
            className={cn(
              "mx-auto w-full px-4 sm:px-6",
              !bleed && "max-w-6xl"
            )}
          >
            {children}
            <div className="h-6 sm:h-10" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}
