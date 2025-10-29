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

	// Role and status
	role: recipientRoleTuple,
	status: recipientStatusTuple,

	// Order for signing sequence (if needed)
	order: v.optional(v.number()), // For sequential signing workflows

	// Signing token for secure access
	signingToken: v.string(), // Unique token for this recipient
	tokenExpiresAt: v.number(), // Token expiration timestamp

	// Activity timestamps
	sentAt: v.optional(v.number()), // When invitation was sent
	viewedAt: v.optional(v.number()), // When recipient viewed document
	signedAt: v.optional(v.number()), // When recipient signed
	approvedAt: v.optional(v.number()), // When recipient approved (approvers only)
	declinedAt: v.optional(v.number()), // When recipient declined

	// Decline information
	declineReason: v.optional(v.string()),

	// Signature data (for signers)
	signatureData: v.optional(v.string()), // Base64 encoded signature image or typed name
	signatureType: v.optional(
		v.union(
			v.literal("drawn"), // Hand-drawn signature
			v.literal("typed"), // Typed name as signature
			v.literal("uploaded"), // Uploaded signature image
		),
	),

	// IP address for audit trail
	ipAddress: v.optional(v.string()),

	// Metadata
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_document", ["documentId"])
	.index("by_document_status", ["documentId", "status"])
	.index("by_token", ["signingToken"])
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
		status === "signed" ||
		status === "approved" ||
		status === "declined"
	);
}
