import { type Infer, v } from "convex/values";

/**
 * Document workflow status represents the signing/completion state
 * This is separate from the lifecycle status (active/archived/deleted)
 *
 * Workflow states:
 * - draft: Document created but not sent to recipients yet
 * - sent: Document sent to recipients, waiting for action
 * - in_progress: At least one recipient has viewed/started signing
 * - waiting_for_payment: All signatures collected, payment pending
 * - completed: All required signatures collected and payment received
 * - cancelled: Workflow cancelled by sender
 * - declined: One or more recipients declined to sign
 * - expired: Document expired before all signatures were collected
 */
export const documentWorkflowStatusTuple = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("in_progress"),
  v.literal("waiting_for_payment"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("declined"),
  v.literal("expired")
);

export type DocumentWorkflowStatus = Infer<typeof documentWorkflowStatusTuple>;

/**
 * Valid status transitions for document workflow
 */
export const WORKFLOW_TRANSITIONS: Record<
  DocumentWorkflowStatus,
  DocumentWorkflowStatus[]
> = {
  draft: ["sent", "cancelled"],
  sent: ["in_progress", "cancelled", "declined", "expired"],
  in_progress: [
    "completed",
    "waiting_for_payment",
    "cancelled",
    "declined",
    "expired",
  ],
  waiting_for_payment: ["completed", "cancelled"],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
  declined: [], // Terminal state
  expired: ["sent"], // Can be re-sent
};

/**
 * Check if a workflow status transition is valid
 */
export function isValidWorkflowTransition(
  from: DocumentWorkflowStatus,
  to: DocumentWorkflowStatus
): boolean {
  return WORKFLOW_TRANSITIONS[from].includes(to);
}

/**
 * Get human-readable label for workflow status
 */
export function getWorkflowStatusLabel(status: DocumentWorkflowStatus): string {
  const labels: Record<DocumentWorkflowStatus, string> = {
    draft: "Draft",
    sent: "Sent",
    in_progress: "In Progress",
    waiting_for_payment: "Awaiting Payment",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Declined",
    expired: "Expired",
  };
  return labels[status];
}
