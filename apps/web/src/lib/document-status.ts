export type DocumentWorkflowStatus =
  | "draft"
  | "sent"
  | "in_progress"
  | "waiting_for_payment"
  | "completed"
  | "cancelled"
  | "declined"
  | "expired";

const WORKFLOW_STATUSES: readonly DocumentWorkflowStatus[] = [
  "draft",
  "sent",
  "in_progress",
  "waiting_for_payment",
  "completed",
  "cancelled",
  "declined",
  "expired",
] as const;

export function isWorkflowStatus(
  status: string
): status is DocumentWorkflowStatus {
  return WORKFLOW_STATUSES.some((valid) => valid === status);
}

export function toWorkflowStatus(status: string): DocumentWorkflowStatus {
  return isWorkflowStatus(status) ? status : "draft";
}
