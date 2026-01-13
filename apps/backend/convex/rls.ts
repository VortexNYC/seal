/**
 * Row-Level Security (RLS) for Seal Convex Backend
 *
 * This module provides row-level access control for all database operations.
 * It wraps the standard query and mutation functions to enforce access rules
 * based on user authentication, organization membership, and permissions.
 *
 * Based on the studio-1 reference implementation pattern.
 */

import type { Rules } from "convex-helpers/server/rowLevelSecurity";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { getAuthContextWithPermissions } from "./auth/auth.permissions";
import type { RecipientRole } from "./schemas/document_recipients";

/**
 * RLS Context type for Seal
 * Extended from studio-1 to support Seal's permission system
 */
export type SealRLSContext = {
	// Core identity
	userId: Id<"users"> | null;
	orgId: Id<"organizations"> | null;

	// Role and permissions
	role: string | null;
	permissions: string[];
	isOwner: boolean;
	isAdmin: boolean;
	isSuperAdmin: boolean;

	// Permission helpers
	hasPermission: (permission: string) => boolean;
	hasAnyPermission: (permissions: string[]) => boolean;
	hasAllPermissions: (permissions: string[]) => boolean;

	// Document access cache (for performance)
	documentAccessCache: Map<
		Id<"documents">,
		"owner" | "manage" | "edit" | "view" | "none"
	>;

	// Recipient context (for token-based access via document_recipients)
	recipientContext?: {
		recipientId: Id<"document_recipients">;
		documentId: Id<"documents">;
		email: string;
		role: RecipientRole;
	};
};

/**
 * Get RLS context from query context
 * Returns null if user is not authenticated
 */
async function getRLSContext(ctx: QueryCtx): Promise<SealRLSContext | null> {
	try {
		const auth = await getAuthContextWithPermissions(ctx);
		const isSuperAdmin = auth.permissions.includes("*");

		return {
			userId: auth.userId,
			orgId: auth.organizationId,
			role: auth.role,
			permissions: auth.permissions,
			isOwner: auth.isOwner,
			isAdmin: auth.isAdmin,
			isSuperAdmin,
			hasPermission: auth.hasPermission,
			hasAnyPermission: auth.hasAnyPermission,
			hasAllPermissions: auth.hasAllPermissions,
			documentAccessCache: new Map(),
		};
	} catch {
		// User is not authenticated
		return null;
	}
}

/**
 * Helper: Get document access level for a user
 * Handles the complex sharing logic (owner, workspace, specific)
 */
async function getDocumentAccessLevel(
	ctx: QueryCtx,
	rlsCtx: SealRLSContext,
	doc: Doc<"documents">,
): Promise<"owner" | "manage" | "edit" | "view" | "none"> {
	// Super admin always has full access
	if (rlsCtx.isSuperAdmin) return "owner";

	// Check cache first
	const cached = rlsCtx.documentAccessCache.get(doc._id);
	if (cached !== undefined) {
		return cached;
	}

	let accessLevel: "owner" | "manage" | "edit" | "view" | "none" = "none";

	// Owner always has full access
	if (doc.ownerId === rlsCtx.userId) {
		accessLevel = "owner";
	} else if (doc.organizationId === rlsCtx.orgId) {
		// Check sharing mode for org members
		if (doc.sharingMode === "workspace") {
			// All workspace members can view
			accessLevel = "view";
		} else if (doc.sharingMode === "specific") {
			// Check document_access table for specific grants
			const currentUserId = rlsCtx.userId;
			if (currentUserId) {
				const access = await ctx.db
					.query("document_access")
					.withIndex("by_document_user", (q) =>
						q.eq("documentId", doc._id).eq("userId", currentUserId),
					)
					.first();

				if (access && !access.revokedAt) {
					accessLevel = access.permissionLevel;
				}
			}
		}
		// "private" means only owner - already handled above
	}

	// Cache the result
	rlsCtx.documentAccessCache.set(doc._id, accessLevel);
	return accessLevel;
}

/**
 * Strict type that requires RLS rules for ALL tables in DataModel
 * TypeScript will error if any table is missing rules
 */
type StrictRules = {
	[K in keyof DataModel]: {
		read: (ctx: QueryCtx, doc: DataModel[K]["document"]) => Promise<boolean>;
		modify: (ctx: QueryCtx, doc: DataModel[K]["document"]) => Promise<boolean>;
	};
};

/**
 * Define RLS rules for each table
 * Exported for use in authQuery/authMutation wrappers
 */
export async function rlsRules(
	ctx: QueryCtx,
): Promise<Rules<QueryCtx, DataModel>> {
	const rlsCtx = await getRLSContext(ctx);

	// TypeScript will error if any table from DataModel is missing
	const rules: StrictRules = {
		// ====================
		// User Management
		// ====================
		users: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				// User can read their own record
				if (doc._id === rlsCtx.userId) return true;
				// Org members with users:view can see other members
				const currentOrgId = rlsCtx.orgId;
				if (rlsCtx.hasPermission("users:view") && currentOrgId) {
					// Check if user is in the same organization
					const membership = await ctx.db
						.query("organization_members")
						.withIndex("by_user_organization", (q) =>
							q.eq("userId", doc._id).eq("organizationId", currentOrgId),
						)
						.first();
					return membership !== null && membership.status === "active";
				}
				return false;
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				// Users can only modify their own record
				return doc._id === rlsCtx.userId;
			},
		},

		user_profiles: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (!rlsCtx.userId) return false;
				// Users can only read their own profile
				// Look up user by clerkUserId to check ownership
				const user = await ctx.db.get(rlsCtx.userId);
				return user !== null && user.clerkId === doc.clerkUserId;
			},
			modify: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (!rlsCtx.userId) return false;
				const user = await ctx.db.get(rlsCtx.userId);
				return user !== null && user.clerkId === doc.clerkUserId;
			},
		},

		saved_signatures: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				return doc.userId === rlsCtx.userId;
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				return doc.userId === rlsCtx.userId;
			},
		},

		// ====================
		// Organization Management
		// ====================
		organizations: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				// Members can read their organization
				return rlsCtx.orgId === doc._id;
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc._id) return false;
				// Need organization:manage permission
				return rlsCtx.hasPermission("organization:manage");
			},
		},

		organization_members: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				// Can read own membership
				if (doc.userId === rlsCtx.userId) return true;
				// Can read members of same org
				return rlsCtx.orgId === doc.organizationId;
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc.organizationId) return false;
				// Owner can modify anyone
				if (rlsCtx.isOwner) return true;
				// Admin can modify non-owners
				if (rlsCtx.isAdmin && doc.role !== "owner") return true;
				return false;
			},
		},

		organization_invitations: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				// Can see invitations in same org
				if (rlsCtx.orgId === doc.organizationId) return true;
				// Can see invitations sent by user
				if (doc.invitedBy === rlsCtx.userId) return true;
				return false;
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc.organizationId) return false;
				// Inviter can modify
				if (doc.invitedBy === rlsCtx.userId) return true;
				// Admin can modify
				return rlsCtx.isAdmin;
			},
		},

		organization_roles: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				// Members can read roles in their org
				return rlsCtx.orgId === doc.organizationId;
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc.organizationId) return false;
				// Need users:roles permission
				return rlsCtx.hasPermission("users:roles");
			},
		},

		// ====================
		// Documents (Complex Sharing Logic)
		// ====================
		documents: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (doc.status === "deleted") return false;

				// Check for recipient context (token-based access)
				if (rlsCtx.recipientContext) {
					return doc._id === rlsCtx.recipientContext.documentId;
				}

				const access = await getDocumentAccessLevel(ctx, rlsCtx, doc);
				return access !== "none";
			},
			modify: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (doc.status === "deleted") return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, doc);
				return access === "owner" || access === "manage" || access === "edit";
			},
		},

		document_access: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				// Can read own access grants
				if (doc.userId === rlsCtx.userId) return true;

				// Document owner/manager can see all grants
				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access === "owner" || access === "manage";
			},
			modify: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access === "owner" || access === "manage";
			},
		},

		document_recipients: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				// Check for recipient context (token-based access)
				if (rlsCtx.recipientContext) {
					return doc._id === rlsCtx.recipientContext.recipientId;
				}

				// Check if user is the recipient
				if (doc.userId && doc.userId === rlsCtx.userId) return true;

				// Check document access
				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access !== "none";
			},
			modify: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				// Check for recipient context (token-based signing)
				if (rlsCtx.recipientContext) {
					// Recipients can only modify their own record
					return doc._id === rlsCtx.recipientContext.recipientId;
				}

				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				// Only owner can modify recipients
				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access === "owner";
			},
		},

		document_reminders: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access !== "none";
			},
			modify: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access === "owner";
			},
		},

		// ====================
		// Signature Workflow (legacy recipients table)
		// ====================
		recipients: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				// Note: This is the legacy recipients table, not document_recipients
				// Token-based access uses document_recipients.signingToken
				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access !== "none";
			},
			modify: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access === "owner";
			},
		},

		signature_fields: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				// Check for recipient context
				if (rlsCtx.recipientContext) {
					return doc.documentId === rlsCtx.recipientContext.documentId;
				}

				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access !== "none";
			},
			modify: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				// Recipient can modify their assigned fields (for signing)
				if (rlsCtx.recipientContext) {
					// Check if field is assigned to this recipient
					return (
						doc.documentId === rlsCtx.recipientContext.documentId &&
						doc.recipientId === rlsCtx.recipientContext.recipientId
					);
				}

				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				// Owner can always modify, edit access for draft documents
				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				if (access === "owner") return true;
				if (access === "edit" && document.workflowStatus === "draft")
					return true;
				return false;
			},
		},

		signatures: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				// Check for recipient context
				if (rlsCtx.recipientContext) {
					return doc.documentId === rlsCtx.recipientContext.documentId;
				}

				const document = await ctx.db.get(doc.documentId);
				if (!document) return false;

				const access = await getDocumentAccessLevel(ctx, rlsCtx, document);
				return access !== "none";
			},
			modify: async () => {
				// Signatures are immutable after creation (audit trail)
				// Only internal mutations can modify
				return false;
			},
		},

		// ====================
		// Templates
		// ====================
		templates: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (doc.status === "deleted") return false;
				if (rlsCtx.orgId !== doc.organizationId) return false;

				return (
					rlsCtx.hasPermission("templates:view") ||
					rlsCtx.hasPermission("templates:read")
				);
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (doc.status === "deleted") return false;
				if (rlsCtx.orgId !== doc.organizationId) return false;

				// Creator can always edit their templates
				if (doc.createdBy === rlsCtx.userId) return true;

				// Otherwise need edit permission
				return rlsCtx.hasPermission("templates:edit");
			},
		},

		template_fields: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				const template = await ctx.db.get(doc.templateId);
				if (!template || template.status === "deleted") return false;
				if (rlsCtx.orgId !== template.organizationId) return false;

				return rlsCtx.hasPermission("templates:view");
			},
			modify: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;

				const template = await ctx.db.get(doc.templateId);
				if (!template || template.status === "deleted") return false;
				if (rlsCtx.orgId !== template.organizationId) return false;

				if (template.createdBy === rlsCtx.userId) return true;
				return rlsCtx.hasPermission("templates:edit");
			},
		},

		// ====================
		// Audit and Compliance
		// ====================
		audit_logs: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc.organizationId) return false;

				return (
					rlsCtx.hasPermission("audit:view") ||
					rlsCtx.hasPermission("audit:read")
				);
			},
			modify: async () => {
				// Audit logs are append-only via internal mutations
				return false;
			},
		},

		email_logs: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc.organizationId) return false;

				// Only admins can view email logs
				return rlsCtx.isAdmin;
			},
			modify: async () => {
				// Email logs are system-managed
				return false;
			},
		},

		// ====================
		// Subscriptions (System-Managed)
		// ====================
		subscriptions: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				// Users can read their own subscription
				return doc.userId === rlsCtx.userId;
			},
			modify: async () => {
				// Subscriptions are modified via Stripe webhooks only
				return false;
			},
		},

		subscription_products: {
			read: async () => {
				// All authenticated users can read products
				return rlsCtx !== null;
			},
			modify: async () => {
				// Modified via webhooks/internal mutations only
				return false;
			},
		},

		subscription_prices: {
			read: async () => {
				// All authenticated users can read prices
				return rlsCtx !== null;
			},
			modify: async () => {
				// Modified via webhooks/internal mutations only
				return false;
			},
		},

		// ====================
		// Integrations
		// ====================
		connected_apps: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				return doc.userId === rlsCtx.userId;
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				return doc.userId === rlsCtx.userId;
			},
		},

		integration_activity_logs: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				return doc.userId === rlsCtx.userId;
			},
			modify: async () => {
				return false;
			},
		},

		notifications: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				return doc.userId === rlsCtx.userId;
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				return doc.userId === rlsCtx.userId;
			},
		},

		// ====================
		// Webhooks
		// ====================
		webhook_endpoints: {
			read: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc.organizationId) return false;
				// Need settings:integrations permission to view webhooks
				return rlsCtx.hasPermission("settings:integrations");
			},
			modify: async (_ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc.organizationId) return false;
				// Need settings:integrations permission to modify webhooks
				return rlsCtx.hasPermission("settings:integrations");
			},
		},

		webhook_deliveries: {
			read: async (ctx, doc) => {
				if (!rlsCtx) return false;
				if (rlsCtx.isSuperAdmin) return true;
				if (rlsCtx.orgId !== doc.organizationId) return false;

				// Check if user can access the parent endpoint
				const endpoint = await ctx.db.get(doc.endpointId);
				if (!endpoint) return false;

				return rlsCtx.hasPermission("settings:integrations");
			},
			modify: async () => {
				// Deliveries are system-managed
				return false;
			},
		},

		// ====================
		// Rate Limiting
		// ====================
		rate_limit_buckets: {
			read: async () => {
				// Rate limit buckets are only accessed by the system internally
				// No direct user access
				return false;
			},
			modify: async () => {
				// Rate limit buckets are only modified by internal mutations
				return false;
			},
		},

		// ====================
		// MCP OAuth (Internal Use Only)
		// ====================
		mcp_oauth_clients: {
			read: async () => {
				// MCP OAuth clients are only accessed by the MCP server internally
				return false;
			},
			modify: async () => {
				// MCP OAuth clients are only modified by internal mutations
				return false;
			},
		},

		mcp_oauth_codes: {
			read: async () => {
				// MCP OAuth codes are only accessed by the MCP server internally
				return false;
			},
			modify: async () => {
				// MCP OAuth codes are only modified by internal mutations
				return false;
			},
		},

		mcp_oauth_refresh_tokens: {
			read: async () => {
				// MCP OAuth refresh tokens are only accessed by the MCP server internally
				return false;
			},
			modify: async () => {
				// MCP OAuth refresh tokens are only modified by internal mutations
				return false;
			},
		},
	};

	return rules as Rules<QueryCtx, DataModel>;
}
