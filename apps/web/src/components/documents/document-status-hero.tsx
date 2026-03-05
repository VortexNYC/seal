/**
 * Document status hero section displaying the current workflow status.
 */

import { formatDate, getStatusLabel } from "@/lib/formatting";

import type { DocumentWorkflowStatus } from "./workflow-status-badge";

interface DocumentStatusHeroProps {
  workflowStatus: DocumentWorkflowStatus | undefined;
  createdAt: number;
}

export function DocumentStatusHero({ workflowStatus, createdAt }: DocumentStatusHeroProps) {
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
    return workflowStatus === "completed" ? "text-status-completed-text" : "text-foreground";
  };

  return (
    <div className={`rounded-2xl border p-6 text-center sm:rounded-xl sm:p-4 ${getStatusStyles()}`}>
      <div className="mb-2 font-sans text-[10px] font-semibold tracking-widest text-stone-500 uppercase dark:text-stone-400">
        Document Status
      </div>
      <div className={`mb-1 font-serif text-3xl font-medium sm:text-2xl ${getTextStyles()}`}>
        {getStatusLabel(workflowStatus)}
      </div>
      <div className="font-sans text-sm text-stone-500 sm:text-xs dark:text-stone-400">
        Created {formatDate(createdAt)}
      </div>
    </div>
  );
}
