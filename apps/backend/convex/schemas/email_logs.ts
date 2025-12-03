import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

/**
 * Email type - category of email sent
 */
export const emailTypeTuple = v.union(
	v.literal("document_invitation"), // Initial document signing invitation
	v.literal("document_reminder"), // Reminder to sign document
	v.literal("signing_complete"), // Confirmation after signing
	v.literal("document_completed"), // Notification when all signatures collected
	v.literal("welcome"), // Welcome email for new users
	v.literal("team_invitation"), // Team/organization invitation
);
export type EmailType = Infer<typeof emailTypeTuple>;

/**
 * Email delivery status
 */
export const emailStatusTuple = v.union(
	v.literal("queued"), // Email is queued for sending
	v.literal("sent"), // Email was sent successfully
	v.literal("delivered"), // Email was delivered (confirmed by provider)
	v.literal("opened"), // Email was opened by recipient
	v.literal("clicked"), // Link in email was clicked
	v.literal("bounced"), // Email bounced
	v.literal("complained"), // Recipient marked as spam
	v.literal("failed"), // Failed to send
);
export type EmailStatus = Infer<typeof emailStatusTuple>;

/**
 * Email logs table
 * Tracks all emails sent through the system
 */
export const emailLogsTable = defineTable({
	// Email identification
	messageId: v.optional(v.string()), // Resend message ID
	type: emailTypeTuple,

	// Recipient information
	toEmail: v.string(),
	toName: v.optional(v.string()),

	// Sender information (who triggered the email)
	fromUserId: v.optional(v.id("users")), // User who triggered the email (if applicable)

	// Related entities
	documentId: v.optional(v.id("documents")),
	recipientId: v.optional(v.id("document_recipients")),
	organizationId: v.optional(v.id("organizations")),
	reminderId: v.optional(v.id("document_reminders")),
	invitationId: v.optional(v.id("organization_invitations")),

	// Delivery tracking
	status: emailStatusTuple,
	sentAt: v.optional(v.number()),
	deliveredAt: v.optional(v.number()),
	openedAt: v.optional(v.number()),
	clickedAt: v.optional(v.number()),
	bouncedAt: v.optional(v.number()),
	complainedAt: v.optional(v.number()),
	failedAt: v.optional(v.number()),

	// Error tracking
	lastError: v.optional(v.string()),
	attemptCount: v.number(),

	// Retry tracking
	nextRetryAt: v.optional(v.number()), // When to retry if failed
	maxRetries: v.number(), // Maximum retry attempts

	// Email content (for debugging/auditing)
	subject: v.optional(v.string()),

	// Metadata
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_message_id", ["messageId"])
	.index("by_type", ["type"])
	.index("by_status", ["status"])
	.index("by_to_email", ["toEmail"])
	.index("by_document", ["documentId"])
	.index("by_recipient", ["recipientId"])
	.index("by_organization", ["organizationId"])
	.index("by_created_at", ["createdAt"])
	.index("by_status_retry", ["status", "nextRetryAt"]);

/**
 * Get human-readable label for email type
 */
export function getEmailTypeLabel(type: EmailType): string {
	const labels: Record<EmailType, string> = {
		document_invitation: "Document Invitation",
		document_reminder: "Document Reminder",
		signing_complete: "Signing Complete",
		document_completed: "Document Completed",
		welcome: "Welcome",
		team_invitation: "Team Invitation",
	};
	return labels[type];
}

/**
 * Get human-readable label for email status
 */
export function getEmailStatusLabel(status: EmailStatus): string {
	const labels: Record<EmailStatus, string> = {
		queued: "Queued",
		sent: "Sent",
		delivered: "Delivered",
		opened: "Opened",
		clicked: "Clicked",
		bounced: "Bounced",
		complained: "Marked as Spam",
		failed: "Failed",
	};
	return labels[status];
}

/**
 * Check if email is in a terminal state (no more updates expected)
 */
export function isEmailTerminal(status: EmailStatus): boolean {
	return status === "bounced" || status === "complained" || status === "failed";
}

/**
 * Check if email delivery was successful
 */
export function isEmailSuccessful(status: EmailStatus): boolean {
	return (
		status === "sent" ||
		status === "delivered" ||
		status === "opened" ||
		status === "clicked"
	);
}
