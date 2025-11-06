import { defineTable } from "convex/server";
import { type Infer, v } from "convex/values";

/**
 * Recipients Table Schema
 *
 * Manages document recipients who need to view, sign, or approve documents.
 * Tracks signing status, authentication, and access information.
 *
 * Based on: /docs/design-phase/information-architecture/data-relationships.md
 * Feature: Recipient Management - Feature #8
 */

// Authentication methods for recipients
export const authenticationMethodTuple = v.union(
	v.literal("email"), // Email link authentication
	v.literal("sms"), // SMS code authentication
	v.literal("none"), // No authentication required
);
export type AuthenticationMethod = Infer<typeof authenticationMethodTuple>;

// Recipient status throughout signing workflow
export const recipientStatusTuple = v.union(
	v.literal("pending"), // Invitation sent, not yet viewed
	v.literal("viewed"), // Document accessed but not signed
	v.literal("signed"), // All required fields completed
	v.literal("declined"), // Recipient declined to sign
);
export type RecipientStatus = Infer<typeof recipientStatusTuple>;

export const recipientsTable = defineTable({
	// References
	documentId: v.id("documents"), // Document being signed

	// Recipient Information
	email: v.string(), // Recipient email address
	name: v.string(), // Recipient name
	role: v.string(), // Recipient role (e.g., "Signer", "Approver", "CC")

	// Signing Order & Flow
	signingOrder: v.number(), // Order in which recipient should sign (0 for parallel)

	// Authentication
	authenticationMethod: authenticationMethodTuple, // How recipient authenticates
	accessToken: v.string(), // Unique token for document access

	// Status Tracking
	status: recipientStatusTuple, // Current status in workflow

	// Access Information
	accessedAt: v.optional(v.number()), // When document was first viewed
	signedAt: v.optional(v.number()), // When signing was completed
	declinedAt: v.optional(v.number()), // When recipient declined
	declineReason: v.optional(v.string()), // Reason for declining

	// Security Information
	ipAddress: v.optional(v.string()), // IP address of recipient
	userAgent: v.optional(v.string()), // Browser/device information

	// Communication
	lastReminderSentAt: v.optional(v.number()), // When last reminder was sent
	reminderCount: v.optional(v.number()), // Number of reminders sent

	// Timestamps
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_document", ["documentId"])
	.index("by_email", ["email"])
	.index("by_access_token", ["accessToken"])
	.index("by_status", ["status"])
	.index("by_document_status", ["documentId", "status"])
	.index("by_document_order", ["documentId", "signingOrder"]);
