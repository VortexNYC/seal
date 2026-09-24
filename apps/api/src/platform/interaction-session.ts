/**
 * InteractionSession helpers for Seal API (ADR-004 / SEA-61).
 * Keep in sync with packages/sdk/src/interaction.ts until Core owns the package.
 */

export type InteractionStatus =
  | "pending"
  | "completed"
  | "cancelled"
  | "declined"
  | "expired";

export type InteractionSession = {
  id: string;
  kind: "sign" | string;
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
  message: string;
};

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
