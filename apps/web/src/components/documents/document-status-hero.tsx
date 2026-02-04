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
        return "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800";
      case "in_progress":
        return "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800";
      case "sent":
        return "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800";
      default:
        return "bg-amber-50/50 dark:bg-amber-950/50 border-amber-200/50 dark:border-amber-800/50";
    }
  };

  const getTextStyles = () => {
    return workflowStatus === "completed"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-stone-800 dark:text-stone-200";
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
