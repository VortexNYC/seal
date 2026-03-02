import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

/**
 * Recipient role defines what action they need to take
 */
export const recipientRoleTuple = v.union(
  v.literal("signer"), // Must sign the document
  v.literal("viewer"), // Can only view the document
  v.literal("approver"), // Must approve before signing can proceed
);
export type RecipientRole = Infer<typeof recipientRoleTuple>;

/**
 * Recipient status tracks their progress through the workflow
 */
export const recipientStatusTuple = v.union(
  v.literal("pending"), // Waiting for action
  v.literal("viewed"), // Has viewed the document
  v.literal("signed"), // Has signed the document
  v.literal("approved"), // Has approved the document (approvers only)
  v.literal("declined"), // Declined to sign/approve
  v.literal("expired"), // Signing period expired
);
export type RecipientStatus = Infer<typeof recipientStatusTuple>;

/**
 * Document recipients table
 * Tracks who needs to take action on a document and their progress
 */
export const documentRecipientsTable = defineTable({
  // Document reference
  documentId: v.id("documents"),

  // Recipient information
  email: v.string(),
  name: v.optional(v.string()),
  userId: v.optional(v.id("users")), // Link to user account if recipient has one

  // Role and status
  role: recipientRoleTuple,
  status: recipientStatusTuple,

  // Order for signing sequence (if needed)
  order: v.optional(v.number()), // For sequential signing workflows

  // Signing token for secure access
  signingToken: v.string(), // Unique token for this recipient (plaintext — being deprecated)
  tokenHash: v.optional(v.string()), // SHA-256 hash of signingToken for secure lookup
  tokenExpiresAt: v.number(), // Token expiration timestamp

  // Activity timestamps
  sentAt: v.optional(v.number()), // When invitation was sent
  viewedAt: v.optional(v.number()), // When recipient viewed document
  signedAt: v.optional(v.number()), // When recipient signed
  approvedAt: v.optional(v.number()), // When recipient approved (approvers only)
  declinedAt: v.optional(v.number()), // When recipient declined

  // Decline information
  declineReason: v.optional(v.string()),

  // SEA-119: Per-recipient custom message for email
  customMessage: v.optional(v.string()), // Custom message included in email to this recipient

  // Signature data (for signers)
  signatureData: v.optional(v.string()), // Base64 encoded signature image or typed name
  signatureType: v.optional(
    v.union(
      v.literal("drawn"), // Hand-drawn signature
      v.literal("typed"), // Typed name as signature
      v.literal("uploaded"), // Uploaded signature image
    ),
  ),

  // ESIGN Act consent tracking
  esignConsentAt: v.optional(v.number()), // Timestamp when consent was given
  esignConsentIp: v.optional(v.string()), // IP address at time of consent
  esignConsentVersion: v.optional(v.string()), // Version of consent text accepted

  // IP address for audit trail
  ipAddress: v.optional(v.string()),

  // Expiration enforcement
  expiresAt: v.optional(v.number()),
  expirationNotifiedAt: v.optional(v.number()),

  // Dictate next signer
  isPlaceholder: v.optional(v.boolean()), // True if name/email are TBD (to be filled by previous signer)
  dictatedBy: v.optional(v.id("document_recipients")), // Which recipient designated this one
  dictatedAt: v.optional(v.number()), // When the designation happened
  awaitingDictation: v.optional(v.boolean()), // Previous signer signed but hasn't designated next yet

  // Metadata
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_document_status", ["documentId", "status"])
  .index("by_token", ["signingToken"])
  .index("by_token_hash", ["tokenHash"])
  .index("by_email", ["email"])
  .index("by_document_order", ["documentId", "order"]);

/**
 * Get human-readable label for recipient role
 */
export function getRecipientRoleLabel(role: RecipientRole): string {
  const labels: Record<RecipientRole, string> = {
    signer: "Signer",
    viewer: "Viewer",
    approver: "Approver",
  };
  return labels[role];
}

/**
 * Get human-readable label for recipient status
 */
export function getRecipientStatusLabel(status: RecipientStatus): string {
  const labels: Record<RecipientStatus, string> = {
    pending: "Pending",
    viewed: "Viewed",
    signed: "Signed",
    approved: "Approved",
    declined: "Declined",
    expired: "Expired",
  };
  return labels[status];
}

/**
 * Check if recipient has completed their required action
 */
export function isRecipientComplete(role: RecipientRole, status: RecipientStatus): boolean {
  switch (role) {
    case "signer":
      return status === "signed";
    case "approver":
      return status === "approved";
    case "viewer":
      return status === "viewed";
    default:
      return false;
  }
}

/**
 * Check if recipient is in a terminal state
 */
export function isRecipientTerminal(status: RecipientStatus): boolean {
  return (
    status === "signed" || status === "approved" || status === "declined" || status === "expired"
  );
}
