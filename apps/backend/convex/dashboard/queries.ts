/**
 * Dashboard queries
 *
 * SEA-129: Sender Dashboard
 *
 * Queries for dashboard statistics, recent activity, and analytics
 */

import { v } from "convex/values";
import { permissionQuery } from "../auth";

/**
 * Get document statistics for the dashboard
 * Returns counts by workflow status
 */
export const getDocumentStats = permissionQuery("documents:view")({
	args: {},
	handler: async (ctx) => {
		const organizationId = ctx.auth.organization._id;

		// Get all documents for the organization
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organizationId),
			)
			.filter((q) => q.neq(q.field("status"), "deleted"))
			.collect();

		// Calculate stats
		const stats = {
			total: documents.length,
			draft: 0,
			sent: 0,
			inProgress: 0,
			completed: 0,
			cancelled: 0,
			declined: 0,
		};

		for (const doc of documents) {
			const status = doc.workflowStatus ?? "draft";
			switch (status) {
				case "draft":
					stats.draft++;
					break;
				case "sent":
					stats.sent++;
					break;
				case "in_progress":
					stats.inProgress++;
					break;
				case "completed":
					stats.completed++;
					break;
				case "cancelled":
					stats.cancelled++;
					break;
				case "declined":
					stats.declined++;
					break;
			}
		}

		// Calculate pending (sent + in_progress)
		const pending = stats.sent + stats.inProgress;

		// Calculate completion rate (completed / (completed + cancelled + declined))
		const finishedDocs = stats.completed + stats.cancelled + stats.declined;
		const completionRate =
			finishedDocs > 0 ? Math.round((stats.completed / finishedDocs) * 100) : 0;

		return {
			...stats,
			pending,
			completionRate,
		};
	},
});

/**
 * Get recent documents for the dashboard
 * Returns the 10 most recently updated documents
 */
export const getRecentDocuments = permissionQuery("documents:view")({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const organizationId = ctx.auth.organization._id;
		const limit = args.limit ?? 10;

		const documents = await ctx.db
			.query("documents")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organizationId),
			)
			.filter((q) => q.neq(q.field("status"), "deleted"))
			.order("desc")
			.take(limit);

		// Enrich with recipient count
		const enrichedDocs = await Promise.all(
			documents.map(async (doc) => {
				const recipients = await ctx.db
					.query("document_recipients")
					.withIndex("by_document", (q) => q.eq("documentId", doc._id))
					.collect();

				const signedCount = recipients.filter(
					(r) => r.status === "signed",
				).length;

				return {
					_id: doc._id,
					name: doc.name,
					workflowStatus: doc.workflowStatus ?? "draft",
					createdAt: doc.createdAt,
					updatedAt: doc.updatedAt,
					thumbnailDataUrl: doc.thumbnailDataUrl,
					recipientCount: recipients.length,
					signedCount,
				};
			}),
		);

		return enrichedDocs;
	},
});

/**
 * Get document volume trends for charts
 * Returns document counts grouped by day for the last 30 days
 */
export const getDocumentTrends = permissionQuery("documents:view")({
	args: {
		days: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const organizationId = ctx.auth.organization._id;
		const days = args.days ?? 30;

		// Calculate the start date
		const now = Date.now();
		const startDate = now - days * 24 * 60 * 60 * 1000;

		// Get documents created in the time range
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organizationId),
			)
			.filter((q) =>
				q.and(
					q.neq(q.field("status"), "deleted"),
					q.gte(q.field("createdAt"), startDate),
				),
			)
			.collect();

		// Get completed documents in the time range (by updatedAt)
		const completedDocs = documents.filter(
			(d) =>
				d.workflowStatus === "completed" &&
				d.updatedAt &&
				d.updatedAt >= startDate,
		);

		// Group by day
		const dailyStats = new Map<
			string,
			{ created: number; completed: number }
		>();

		// Initialize all days with 0
		for (let i = 0; i < days; i++) {
			const date = new Date(now - i * 24 * 60 * 60 * 1000);
			const dateKey = date.toISOString().split("T")[0] ?? "";
			if (dateKey) {
				dailyStats.set(dateKey, { created: 0, completed: 0 });
			}
		}

		// Count created documents
		for (const doc of documents) {
			const dateKey = new Date(doc.createdAt).toISOString().split("T")[0] ?? "";
			const existing = dailyStats.get(dateKey);
			if (existing) {
				existing.created++;
			}
		}

		// Count completed documents
		for (const doc of completedDocs) {
			if (doc.updatedAt) {
				const dateKey =
					new Date(doc.updatedAt).toISOString().split("T")[0] ?? "";
				const existing = dailyStats.get(dateKey);
				if (existing) {
					existing.completed++;
				}
			}
		}

		// Convert to array and sort by date
		const trend = Array.from(dailyStats.entries())
			.map(([date, stats]) => ({
				date,
				created: stats.created,
				completed: stats.completed,
			}))
			.sort((a, b) => a.date.localeCompare(b.date));

		return trend;
	},
});

/**
 * Get recent activity/audit logs for the dashboard
 * Returns recent actions in the workspace
 */
export const getRecentActivity = permissionQuery("audit:view")({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const organizationId = ctx.auth.organization._id;
		const limit = args.limit ?? 20;

		const logs = await ctx.db
			.query("audit_logs")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organizationId),
			)
			.order("desc")
			.take(limit);

		// Enrich with user info
		const enrichedLogs = await Promise.all(
			logs.map(async (log) => {
				let actorName = "System";
				let actorEmail = "";

				// actorId stores Clerk user ID as string, need to look up by clerkId
				if (log.actorId && log.actorType === "user") {
					const user = await ctx.db
						.query("users")
						.withIndex("by_clerk_id", (q) =>
							q.eq("clerkId", log.actorId as string),
						)
						.first();
					if (user) {
						actorName = user.name ?? user.email.split("@")[0] ?? "Unknown";
						actorEmail = user.email;
					}
				} else if (log.actorType === "recipient" && log.recipientId) {
					const recipient = await ctx.db.get(log.recipientId);
					if (recipient) {
						actorName =
							recipient.name ?? recipient.email.split("@")[0] ?? "Unknown";
						actorEmail = recipient.email;
					}
				}

				return {
					_id: log._id,
					action: log.action,
					resourceType: log.resourceType,
					resourceId: log.resourceId,
					metadata: log.metadata,
					timestamp: log.createdAt,
					actorName,
					actorEmail,
				};
			}),
		);

		return enrichedLogs;
	},
});

/**
 * Get summary stats for a specific time period
 * Used for "this week", "this month" comparisons
 */
export const getPeriodStats = permissionQuery("documents:view")({
	args: {
		period: v.union(
			v.literal("today"),
			v.literal("week"),
			v.literal("month"),
			v.literal("year"),
		),
	},
	handler: async (ctx, args) => {
		const organizationId = ctx.auth.organization._id;
		const now = Date.now();

		// Calculate start date based on period
		let startDate: number;
		switch (args.period) {
			case "today":
				startDate = new Date().setHours(0, 0, 0, 0);
				break;
			case "week":
				startDate = now - 7 * 24 * 60 * 60 * 1000;
				break;
			case "month":
				startDate = now - 30 * 24 * 60 * 60 * 1000;
				break;
			case "year":
				startDate = now - 365 * 24 * 60 * 60 * 1000;
				break;
		}

		// Get documents created in period
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organizationId),
			)
			.filter((q) =>
				q.and(
					q.neq(q.field("status"), "deleted"),
					q.gte(q.field("createdAt"), startDate),
				),
			)
			.collect();

		// Get documents completed in period
		const allDocs = await ctx.db
			.query("documents")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", organizationId),
			)
			.filter((q) => q.neq(q.field("status"), "deleted"))
			.collect();

		const completed = allDocs.filter(
			(d) =>
				d.workflowStatus === "completed" &&
				d.updatedAt &&
				d.updatedAt >= startDate,
		).length;

		return {
			created: documents.length,
			completed,
			period: args.period,
		};
	},
});
