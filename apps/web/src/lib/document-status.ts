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
  if (status === "voided") return "cancelled";
  return isWorkflowStatus(status) ? status : "draft";
}

/** People who had not finished when the envelope was voided are not still waiting. */
export function recipientFacingStatus(
  workflowStatus: DocumentWorkflowStatus | undefined,
  recipientStatus: string
): string {
  if (
    workflowStatus === "cancelled" &&
    (recipientStatus === "pending" || recipientStatus === "viewed")
  ) {
    return "voided";
  }
  return recipientStatus;
}

/** A finished envelope offers the signed file. Every other state can still send. */
export function documentHeaderAction(
  status: string | undefined
): "download" | "send" {
  return status === "completed" ? "download" : "send";
}

/** Download name for the stored PDF. */
export function signedPdfFilename(name: string | null | undefined): string {
  const trimmed = name?.trim() || "document";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

export type SigningProgress = {
  readonly signed: number;
  readonly total: number;
  readonly waitingOn: string | null;
};

/** The second line under a document name on the list. */
export function signerProgressLine(
  status: string | undefined,
  progress: SigningProgress | null | undefined
): string | null {
  if (!progress || progress.total === 0) return null;
  if (status === "draft") {
    return progress.total === 1 ? "1 signer" : `${progress.total} signers`;
  }
  if (status === "cancelled") return null;
  if (status === "declined") {
    return progress.waitingOn
      ? `Declined by ${progress.waitingOn}`
      : "Declined";
  }
  const count = `${progress.signed} of ${progress.total} signed`;
  if (status === "completed" || progress.signed >= progress.total) return count;
  return progress.waitingOn ? `${progress.waitingOn} · ${count}` : count;
}

/** Drafts show when they were uploaded. Everything sent shows when it went out, and the deadline while it is still open. */
export function listRowDate(input: {
  readonly status: string | undefined;
  readonly createdAt: number;
  readonly sentAt: number | null | undefined;
  readonly deadline: number | null | undefined;
  readonly now: number;
}): {
  readonly at: number;
  readonly sent: boolean;
  readonly dueAt: number | null;
  readonly overdue: boolean;
} {
  const sent = Boolean(input.status && input.status !== "draft" && input.sentAt);
  const closed =
    input.status === "completed" ||
    input.status === "cancelled" ||
    input.status === "declined";
  const dueAt = sent && !closed && input.deadline ? input.deadline : null;
  return {
    at: sent && input.sentAt ? input.sentAt : input.createdAt,
    sent,
    dueAt,
    overdue: dueAt !== null && dueAt < input.now,
  };
}

/** The word carries the status. Color is only for a refusal. */
export function recipientMarkClass(status: string): string {
  if (status === "declined" || status === "cancelled" || status === "voided") {
    return "bg-kumo-danger/10 text-kumo-danger";
  }
  return "bg-kumo-base text-kumo-default";
}
