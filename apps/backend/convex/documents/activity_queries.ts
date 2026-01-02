/**
 * Document Activity Queries
 *
 * Queries for retrieving document activity events for the activity feed.
 * Combines document events with recipient events for a complete timeline.
 */

import { ConvexError, v } from "convex/values";
import { authQuery } from "../auth";
import {
	ACCESS_ERRORS,
	checkDocumentAccess,
	getDocumentOrThrow,
} from "../auth/access_control";

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

/**
 * Validator for activity event types - used in query args
 */
const activityEventTypeValidator = v.union(
	v.literal("created"),
	v.literal("recipient_added"),
	v.literal("sent"),
	v.literal("viewed"),
	v.literal("signed"),
	v.literal("approved"),
	v.literal("declined"),
	v.literal("completed"),
	v.literal("cancelled"),
	v.literal("reminder_sent"),
	v.literal("shared"),
	v.literal("access_revoked"),
);

interface ActivityEvent {
	type: ActivityEventType;
	timestamp: number;
	description: string;
	actor?: string;
	actorId?: string; // User ID of the actor for filtering
}

interface PaginatedActivityResult {
	events: ActivityEvent[];
	total: number;
	hasMore: boolean;
}

/**
 * Get activity events for a document
 * Combines audit logs and recipient activity into a unified timeline
 * Supports filtering by actor (member) and event type, with pagination
 */
export const getDocumentActivity = authQuery({
	args: {
		documentId: v.id("documents"),
		limit: v.optional(v.number()),
		offset: v.optional(v.number()),
		actorId: v.optional(v.id("users")), // Filter by specific member
		eventTypes: v.optional(v.array(activityEventTypeValidator)), // Filter by event types
	},
	handler: async (ctx, args): Promise<PaginatedActivityResult> => {
		const userId = ctx.auth.user._id;
		const limit = args.limit ?? 20;
		const offset = args.offset ?? 0;

		const document = await getDocumentOrThrow(ctx, args.documentId);

		const accessResult = await checkDocumentAccess(ctx, userId, document);
		if (!accessResult.hasAccess) {
			throw new ConvexError(ACCESS_ERRORS.NO_ACCESS);
		}

		// Get owner information for actor name
		const owner = await ctx.db.get(document.ownerId);
		const ownerName = owner?.name || owner?.email || "Document owner";
		const ownerId = document.ownerId.toString();

		// 4. Build activity events from document and recipients
		const events: ActivityEvent[] = [];

		// Document creation event
		events.push({
			type: "created",
			timestamp: document.createdAt,
			description: "Document created",
			actor: ownerName,
			actorId: ownerId,
		});

		// Get recipients for recipient events
		const recipients = await ctx.db
			.query("document_recipients")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		// Add recipient-related events
		for (const recipient of recipients) {
			const recipientName = recipient.name || recipient.email;
			// Recipients are external users identified by email, not system users
			// Use a pseudo-ID based on email for filtering purposes
			const recipientActorId = `recipient:${recipient.email}`;

			// Recipient added event (by owner)
			events.push({
				type: "recipient_added",
				timestamp: recipient.createdAt,
				description: `${recipientName} added as ${recipient.role}`,
				actor: ownerName,
				actorId: ownerId,
			});

			// Viewed event (by recipient)
			if (recipient.viewedAt) {
				events.push({
					type: "viewed",
					timestamp: recipient.viewedAt,
					description: `${recipientName} viewed the document`,
					actor: recipientName,
					actorId: recipientActorId,
				});
			}

			// Signed event (by recipient)
			if (recipient.signedAt) {
				events.push({
					type: "signed",
					timestamp: recipient.signedAt,
					description: `${recipientName} signed the document`,
					actor: recipientName,
					actorId: recipientActorId,
				});
			}

			// Approved event (by recipient)
			if (recipient.approvedAt) {
				events.push({
					type: "approved",
					timestamp: recipient.approvedAt,
					description: `${recipientName} approved the document`,
					actor: recipientName,
					actorId: recipientActorId,
				});
			}

			// Declined event (by recipient)
			if (recipient.declinedAt) {
				events.push({
					type: "declined",
					timestamp: recipient.declinedAt,
					description: `${recipientName} declined to sign`,
					actor: recipientName,
					actorId: recipientActorId,
				});
			}
		}

		// Document sent event (by owner)
		if (document.sentAt) {
			events.push({
				type: "sent",
				timestamp: document.sentAt,
				description: `Document sent to ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}`,
				actor: ownerName,
				actorId: ownerId,
			});
		}

		// Document completed event (system event, no specific actor)
		if (document.completedAt) {
			events.push({
				type: "completed",
				timestamp: document.completedAt,
				description: "All recipients have completed signing",
			});
		}

		// Document cancelled event (by owner)
		if (document.cancelledAt) {
			events.push({
				type: "cancelled",
				timestamp: document.cancelledAt,
				description: "Document was cancelled",
				actor: ownerName,
				actorId: ownerId,
			});
		}

		// Get reminder events (sent by owner)
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
					actorId: ownerId,
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

			// Access granted event (by granter)
			events.push({
				type: "shared",
				timestamp: access.grantedAt,
				description: `${accessUserName} was given ${access.permissionLevel} access`,
				actor: grantedByName,
				actorId: access.grantedBy.toString(),
			});

			// Access revoked event (by owner typically)
			if (access.revokedAt) {
				events.push({
					type: "access_revoked",
					timestamp: access.revokedAt,
					description: `${accessUserName}'s access was revoked`,
					actor: ownerName,
					actorId: ownerId,
				});
			}
		}

		// 5. Apply filters
		let filteredEvents = events;

		// Filter by actor ID if provided
		if (args.actorId) {
			const actorIdStr = args.actorId.toString();
			filteredEvents = filteredEvents.filter(
				(event) => event.actorId === actorIdStr,
			);
		}

		// Filter by event types if provided
		if (args.eventTypes && args.eventTypes.length > 0) {
			const eventTypeSet = new Set(args.eventTypes);
			filteredEvents = filteredEvents.filter((event) =>
				eventTypeSet.has(event.type),
			);
		}

		// 6. Sort by timestamp descending (most recent first)
		filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

		// 7. Apply pagination
		const total = filteredEvents.length;
		const paginatedEvents = filteredEvents.slice(offset, offset + limit);
		const hasMore = offset + limit < total;

		return {
			events: paginatedEvents,
			total,
			hasMore,
		};
	},
});

/**
 * Get list of unique actors for a document (for the filter dropdown)
 */
export const getDocumentActors = authQuery({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (
		ctx,
		args,
	): Promise<Array<{ id: string; name: string; type: "owner" | "member" }>> => {
		const userId = ctx.auth.user._id;

		const document = await getDocumentOrThrow(ctx, args.documentId);

		const accessResult = await checkDocumentAccess(ctx, userId, document);
		if (!accessResult.hasAccess) {
			throw new ConvexError(ACCESS_ERRORS.NO_ACCESS);
		}

		// Build list of unique actors
		const actorsMap = new Map<
			string,
			{ id: string; name: string; type: "owner" | "member" }
		>();

		// Add owner
		const owner = await ctx.db.get(document.ownerId);
		if (owner) {
			actorsMap.set(document.ownerId.toString(), {
				id: document.ownerId.toString(),
				name: owner.name || owner.email || "Document owner",
				type: "owner",
			});
		}

		// Add users who have been granted access
		const accessRecords = await ctx.db
			.query("document_access")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		for (const access of accessRecords) {
			if (!actorsMap.has(access.userId.toString())) {
				const user = await ctx.db.get(access.userId);
				if (user) {
					actorsMap.set(access.userId.toString(), {
						id: access.userId.toString(),
						name: user.name || user.email || "Unknown",
						type: "member",
					});
				}
			}
			// Also add the granter
			if (!actorsMap.has(access.grantedBy.toString())) {
				const granter = await ctx.db.get(access.grantedBy);
				if (granter) {
					actorsMap.set(access.grantedBy.toString(), {
						id: access.grantedBy.toString(),
						name: granter.name || granter.email || "Unknown",
						type: "member",
					});
				}
			}
		}

		return Array.from(actorsMap.values()).sort((a, b) => {
			// Owner first
			if (a.type === "owner") return -1;
			if (b.type === "owner") return 1;
			return a.name.localeCompare(b.name);
		});
	},
});
