import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface PageAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
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
}: PageWrapperProps) {
  const allActions = action ? [action, ...(actions || [])] : actions || [];

  return (
    <div
      className={cn(
        "bg-muted dark:bg-background flex h-full min-h-0 scroll-pb-24 flex-col overflow-auto overscroll-contain sm:scroll-pb-28",
        className,
      )}
    >
      <div className="sticky top-0 z-10 border-b bg-inherit">
        <div
          className={cn(
            "flex min-h-16 flex-col gap-3 px-4 py-3 sm:px-6",
            headerCenter
              ? "lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-4"
              : "sm:flex-row sm:items-center sm:gap-4 sm:py-0",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center gap-4",
              headerCenter ? "lg:min-w-0" : "flex-1",
            )}
          >
            <SidebarTrigger />
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
              {description && (
                <p className="text-muted-foreground truncate text-xs sm:text-sm">{description}</p>
              )}
            </div>
          </div>
          {headerCenter && <div className="min-w-0 lg:justify-self-center">{headerCenter}</div>}
          {(allActions.length > 0 || headerActions) && (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2",
                headerCenter ? "lg:justify-end lg:justify-self-end" : "sm:flex-nowrap",
              )}
            >
              {headerActions}
              {allActions.map((actionItem, index) => {
                const Icon = actionItem.icon;
                return (
                  <Button
                    key={index}
                    onClick={actionItem.onClick}
                    variant={actionItem.variant || "default"}
                    size="sm"
                    className="flex-1 sm:flex-none"
                    disabled={actionItem.disabled}
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                    <span className="truncate">{actionItem.label}</span>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4 pb-12 sm:p-6 sm:pb-16">
        {children}
        <div className="h-6 sm:h-10" aria-hidden />
      </div>
    </div>
  );
}
