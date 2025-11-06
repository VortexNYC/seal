import { type Infer, v } from "convex/values";

/**
 * Document workflow status represents the signing/completion state
 * This is separate from the lifecycle status (active/archived/deleted)
 *
 * Workflow states:
 * - draft: Document created but not sent to recipients yet
 * - sent: Document sent to recipients, waiting for action
 * - in_progress: At least one recipient has viewed/started signing
 * - completed: All required signatures collected
 * - cancelled: Workflow cancelled by sender
 * - declined: One or more recipients declined to sign
 */
export const documentWorkflowStatusTuple = v.union(
	v.literal("draft"),
	v.literal("sent"),
	v.literal("in_progress"),
	v.literal("completed"),
	v.literal("cancelled"),
	v.literal("declined"),
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
	sent: ["in_progress", "cancelled", "declined"],
	in_progress: ["completed", "cancelled", "declined"],
	completed: [], // Terminal state
	cancelled: [], // Terminal state
	declined: [], // Terminal state
};

/**
 * Check if a workflow status transition is valid
 */
export function isValidWorkflowTransition(
	from: DocumentWorkflowStatus,
	to: DocumentWorkflowStatus,
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
		completed: "Completed",
		cancelled: "Cancelled",
		declined: "Declined",
	};
	return labels[status];
}
