/**
 * InteractionSession — Vortex Workflow A (HTTPS URL + poll).
 * Seal is the first producer (document signing). See ADR-004.
 */

export type InteractionKind = "sign" | "approve" | "unlock" | "pay" | string;

export type InteractionStatus =
  | "pending"
  | "completed"
  | "cancelled"
  | "declined"
  | "expired";

export type InteractionSession = {
  id: string;
  kind: InteractionKind;
  url: string | null;
  status: InteractionStatus;
  expires_at: string | null;
  result?: {
    document_id: string;
    document_status: string;
    title: string | null;
  };
  poll: {
    path: string;
    interval_ms: number;
  };
  /** Human-facing one-liner for hosts that show the link in chat/CLI. */
  message: string;
};

const TERMINAL_DOC = new Set([
  "completed",
  "voided",
  "cancelled",
  "canceled",
  "declined",
  "expired",
]);

export function mapDocumentStatusToInteraction(
  documentStatus: string
): InteractionStatus {
  switch (documentStatus) {
    case "completed":
      return "completed";
    case "declined":
      return "declined";
    case "expired":
      return "expired";
    case "voided":
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "pending";
  }
}

export function isInteractionTerminal(status: InteractionStatus): boolean {
  return status !== "pending";
}

export function isDocumentTerminal(documentStatus: string): boolean {
  return TERMINAL_DOC.has(documentStatus);
}

export function buildSigningInteraction(input: {
  documentId: string;
  documentStatus: string;
  title: string | null;
  signingUrl: string | null;
  expiresAt: string | null;
}): InteractionSession {
  const status = mapDocumentStatusToInteraction(input.documentStatus);
  const title = input.title?.trim() || "document";
  let message: string;
  if (status === "pending" && input.signingUrl) {
    message = `Sign “${title}” — then you can close the tab. The agent will continue.`;
  } else if (status === "pending") {
    message = `Waiting on a human for “${title}” (no signing URL yet — send the document first).`;
  } else if (status === "completed") {
    message = `“${title}” is done.`;
  } else {
    message = `“${title}” ended with status ${status}.`;
  }

  return {
    id: `sign:${input.documentId}`,
    kind: "sign",
    url: input.signingUrl,
    status,
    expires_at: input.expiresAt,
    result: {
      document_id: input.documentId,
      document_status: input.documentStatus,
      title: input.title,
    },
    poll: {
      path: `/api/v1/documents/interaction?id=${encodeURIComponent(input.documentId)}`,
      interval_ms: 2000,
    },
    message,
  };
}
