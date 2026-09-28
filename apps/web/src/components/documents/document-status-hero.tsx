/**
 * Document status hero section displaying the current workflow status.
 */

import { formatDate, getStatusLabel } from "@/lib/formatting";
import { cn } from "@/lib/utils";

import type { DocumentWorkflowStatus } from "./workflow-status-badge";

interface DocumentStatusHeroProps {
  workflowStatus: DocumentWorkflowStatus | undefined;
  createdAt: number;
  /** Draft builder — status only, no ceremony chrome. */
  compact?: boolean;
}

export function DocumentStatusHero({
  workflowStatus,
  createdAt,
  compact = false,
}: DocumentStatusHeroProps) {
  const getStatusStyles = () => {
    switch (workflowStatus) {
      case "completed":
        return "bg-status-completed-surface border-status-completed-border";
      case "in_progress":
        return "bg-status-in-progress-surface border-status-in-progress-border";
      case "waiting_for_payment":
        return "bg-status-in-progress-surface border-status-in-progress-border";
      case "sent":
        return "bg-status-sent-surface border-status-sent-border";
      default:
        return "bg-status-in-progress-surface/50 border-status-in-progress-border/50";
    }
  };

  const getTextStyles = () => {
    return workflowStatus === "completed"
      ? "text-status-completed-text"
      : "text-foreground";
  };

  return (
    <div
      className={cn(
        "rounded-2xl border text-center shadow-sm sm:rounded-xl",
        compact ? "px-4 py-3 sm:py-3" : "p-6 sm:p-5",
        getStatusStyles()
      )}
      aria-live="polite"
    >
      {!compact && (
        <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-[0.16em] uppercase">
          Document Status
        </div>
      )}
      <div
        className={cn(
          "font-semibold",
          compact ? "text-lg sm:text-base" : "mb-1 text-3xl sm:text-2xl",
          getTextStyles()
        )}
      >
        {getStatusLabel(workflowStatus)}
      </div>
      {!compact && (
        <div className="text-muted-foreground text-sm font-medium sm:text-xs">
          Created {formatDate(createdAt)}
        </div>
      )}
    </div>
  );
}
