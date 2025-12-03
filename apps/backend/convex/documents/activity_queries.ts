/**
 * Document Activity Queries
 *
 * Queries for retrieving document activity events for the activity feed.
 * Combines document events with recipient events for a complete timeline.
 */

import { ConvexError, v } from "convex/values";
import { authQuery } from "../auth";

/**
 * Activity event types that map to the frontend ActivityFeed component
 */
export type ActivityEventType =
	| "created"
	| "recipient_added"
	| "sent"
	| "viewed"
	| "signed"
	| "approved"
	| "declined"
	| "completed"
	| "cancelled"
	| "reminder_sent"
	| "shared"
	| "access_revoked";

interface ActivityEvent {
	type: ActivityEventType;
	timestamp: number;
	description: string;
	actor?: string;
}

/**
 * Get activity events for a document
 * Combines audit logs and recipient activity into a unified timeline
 */
export const getDocumentActivity = authQuery({
	args: {
		documentId: v.id("documents"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<ActivityEvent[]> => {
		const userId = ctx.auth.user._id;
		const limit = args.limit ?? 50;

		// 1. Get the document
		const document = await ctx.db.get(args.documentId);
		if (!document || document.status === "deleted") {
			throw new ConvexError("Document not found");
		}

		// 2. Verify access (owner or org member)
		let hasAccess = document.ownerId === userId;
		if (!hasAccess) {
			const member = await ctx.db
				.query("organization_members")
				.withIndex("by_user_organization", (q) =>
					q.eq("userId", userId).eq("organizationId", document.organizationId),
				)
				.first();

			if (member && member.status === "active") {
				if (document.sharingMode === "workspace") {
					hasAccess = true;
				} else if (document.sharingMode === "specific") {
					const access = await ctx.db
						.query("document_access")
						.withIndex("by_document_user", (q) =>
							q.eq("documentId", document._id).eq("userId", userId),
						)
						.first();
					hasAccess = access !== null && access.revokedAt === undefined;
				}
			}
		}

		if (!hasAccess) {
			throw new ConvexError("You don't have access to this document");
		}

		// 3. Get owner information for actor name
		const owner = await ctx.db.get(document.ownerId);
		const ownerName = owner?.name || owner?.email || "Document owner";

		// 4. Build activity events from document and recipients
		const events: ActivityEvent[] = [];

		// Document creation event
		events.push({
			type: "created",
			timestamp: document.createdAt,
			description: `Document created`,
			actor: ownerName,
		});

		// Get recipients for recipient events
		const recipients = await ctx.db
			.query("document_recipients")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		// Add recipient-related events
		for (const recipient of recipients) {
			const recipientName = recipient.name || recipient.email;

			// Recipient added event
			events.push({
				type: "recipient_added",
				timestamp: recipient.createdAt,
				description: `${recipientName} added as ${recipient.role}`,
				actor: ownerName,
			});

			// Viewed event
			if (recipient.viewedAt) {
				events.push({
					type: "viewed",
					timestamp: recipient.viewedAt,
					description: `${recipientName} viewed the document`,
					actor: recipientName,
				});
			}

			// Signed event
			if (recipient.signedAt) {
				events.push({
					type: "signed",
					timestamp: recipient.signedAt,
					description: `${recipientName} signed the document`,
					actor: recipientName,
				});
			}

			// Approved event
			if (recipient.approvedAt) {
				events.push({
					type: "approved",
					timestamp: recipient.approvedAt,
					description: `${recipientName} approved the document`,
					actor: recipientName,
				});
			}

			// Declined event
			if (recipient.declinedAt) {
				events.push({
					type: "declined",
					timestamp: recipient.declinedAt,
					description: `${recipientName} declined to sign`,
					actor: recipientName,
				});
			}
		}

		// Document sent event
		if (document.sentAt) {
			events.push({
				type: "sent",
				timestamp: document.sentAt,
				description: `Document sent to ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}`,
				actor: ownerName,
			});
		}

		// Document completed event
		if (document.completedAt) {
			events.push({
				type: "completed",
				timestamp: document.completedAt,
				description: "All recipients have completed signing",
			});
		}

		// Document cancelled event
		if (document.cancelledAt) {
			events.push({
				type: "cancelled",
				timestamp: document.cancelledAt,
				description: "Document was cancelled",
				actor: ownerName,
			});
		}

		// Get reminder events
		const reminders = await ctx.db
			.query("document_reminders")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.filter((q) => q.eq(q.field("status"), "sent"))
			.collect();

		for (const reminder of reminders) {
			if (reminder.sentAt && reminder.recipientId) {
				const recipient = recipients.find(
					(r) => r._id === reminder.recipientId,
				);
				const recipientName =
					recipient?.name || recipient?.email || "Recipient";
				events.push({
					type: "reminder_sent",
					timestamp: reminder.sentAt,
					description: `Reminder sent to ${recipientName}`,
					actor: ownerName,
				});
			}
		}

		// Get document access events (sharing)
		const accessRecords = await ctx.db
			.query("document_access")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		for (const access of accessRecords) {
			// Get user and granter info
			const accessUser = await ctx.db.get(access.userId);
			const grantedByUser = await ctx.db.get(access.grantedBy);
			const accessUserName = accessUser?.name || accessUser?.email || "User";
			const grantedByName =
				grantedByUser?.name || grantedByUser?.email || "Someone";

			// Access granted event
			events.push({
				type: "shared",
				timestamp: access.grantedAt,
				description: `${accessUserName} was given ${access.permissionLevel} access`,
				actor: grantedByName,
			});

			// Access revoked event
			if (access.revokedAt) {
				events.push({
					type: "access_revoked",
					timestamp: access.revokedAt,
					description: `${accessUserName}'s access was revoked`,
					actor: ownerName,
				});
			}
		}

		// 5. Sort by timestamp descending (most recent first) and limit
		events.sort((a, b) => b.timestamp - a.timestamp);

		return events.slice(0, limit);
	},
});
