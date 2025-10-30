import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

/**
 * Recipient role - what action they need to take
 */
export const recipientRoleTuple = v.union(
	v.literal("signer"), // Must sign the document
	v.literal("viewer"), // View only (for information)
	v.literal("approver"), // Must approve (doesn't sign, just approves)
);
export type RecipientRole = Infer<typeof recipientRoleTuple>;

/**
 * Recipient status - current state of their action
 */
export const recipientStatusTuple = v.union(
	v.literal("pending"), // Invited but hasn't viewed yet
	v.literal("viewed"), // Opened the document
	v.literal("signed"), // Completed signing (for signers)
	v.literal("approved"), // Completed approval (for approvers)
	v.literal("declined"), // Declined to sign/approve
);
export type RecipientStatus = Infer<typeof recipientStatusTuple>;

/**
 * Document recipients table
 * Tracks all recipients who need to take action on a document
 */
export const documentRecipientsTable = defineTable({
	// Document reference
	documentId: v.id("documents"),

	// Recipient information
	email: v.string(),
	name: v.optional(v.string()),

	// Role and status
	role: recipientRoleTuple,
	status: recipientStatusTuple,

	// Secure access token (256-bit cryptographic token)
	signingToken: v.string(), // Unique token for accessing the document
	tokenExpiresAt: v.number(), // When the token expires

	// Activity tracking
	viewedAt: v.optional(v.number()),
	signedAt: v.optional(v.number()),
	approvedAt: v.optional(v.number()),
	declinedAt: v.optional(v.number()),

	// Signature/approval data
	signatureData: v.optional(v.string()), // Signature image or approval note
	ipAddress: v.optional(v.string()), // IP address when action was taken
	userAgent: v.optional(v.string()), // Browser/device info

	// Metadata
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_document", ["documentId"])
	.index("by_signing_token", ["signingToken"])
	.index("by_email", ["email"])
	.index("by_document_status", ["documentId", "status"]);

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
	};
	return labels[status];
}

/**
 * Check if recipient has completed their required action
 */
export function isRecipientComplete(
	role: RecipientRole,
	status: RecipientStatus,
): boolean {
	if (status === "declined") return true;

	switch (role) {
		case "signer":
			return status === "signed";
		case "approver":
			return status === "approved";
		case "viewer":
			return status === "viewed"; // Viewers just need to view
		default:
			return false;
	}
}
