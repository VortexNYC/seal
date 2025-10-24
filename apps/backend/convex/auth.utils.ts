import type { Doc } from "./_generated/dataModel";
import type { OrganizationMemberRole } from "./schema";

/**
 * Role hierarchy levels for permission comparison
 * Higher numbers = more permissions
 */
export const ROLE_HIERARCHY: Record<OrganizationMemberRole, number> = {
	system: 150, // System-level access (highest)
	owner: 100, // Organization owner
	admin: 75, // Organization administrator
	member: 50, // Regular member
	viewer: 25, // Read-only access
};

/**
 * Document signing platform permissions for each role
 */
export const ROLE_PERMISSIONS: Record<OrganizationMemberRole, string[]> = {
	system: [
		// System-level permissions (all permissions)
		"*",
	],
	owner: [
		// Organization management
		"org:manage",
		"org:settings:read",
		"org:settings:update",
		"org:users:read",
		"org:users:invite",
		"org:users:remove",
		"org:users:update_role",
		// Subscription management
		"subscription:manage",
		"subscription:billing:read",
		"subscription:billing:update",
		// Documents (full access)
		"documents:read",
		"documents:create",
		"documents:update",
		"documents:delete",
		"documents:send",
		"documents:cancel",
		"documents:download",
		// Templates (full access)
		"templates:read",
		"templates:create",
		"templates:update",
		"templates:delete",
		"templates:use",
		// Signatures (view all org signatures)
		"signatures:read",
		"signatures:download",
		// Audit & Compliance
		"audit:read",
		"audit:export",
		// API & Webhooks
		"api:read",
		"api:create",
		"api:delete",
		"webhooks:read",
		"webhooks:create",
		"webhooks:update",
		"webhooks:delete",
		// Analytics & Reports
		"analytics:read",
		"reports:read",
		"reports:generate",
		// Data management
		"data:export",
		"data:backup",
	],

	admin: [
		// Organization view
		"org:settings:read",
		"org:users:read",
		"org:users:invite",
		// Subscription view
		"subscription:billing:read",
		// Documents (full access)
		"documents:read",
		"documents:create",
		"documents:update",
		"documents:delete",
		"documents:send",
		"documents:cancel",
		"documents:download",
		// Templates (full access)
		"templates:read",
		"templates:create",
		"templates:update",
		"templates:delete",
		"templates:use",
		// Signatures (view all)
		"signatures:read",
		"signatures:download",
		// Audit (read only)
		"audit:read",
		"audit:export",
		// API & Webhooks (manage)
		"api:read",
		"api:create",
		"api:delete",
		"webhooks:read",
		"webhooks:create",
		"webhooks:update",
		"webhooks:delete",
		// Analytics
		"analytics:read",
		"reports:read",
		"reports:generate",
		// Data export
		"data:export",
	],

	member: [
		// Documents (create and manage own)
		"documents:read",
		"documents:create",
		"documents:update",
		"documents:send",
		"documents:cancel",
		"documents:download",
		// Templates (use existing, create own)
		"templates:read",
		"templates:create",
		"templates:use",
		// Signatures (own documents only)
		"signatures:read",
		"signatures:download",
		// Basic analytics
		"analytics:read",
		"reports:read",
		// Personal data
		"data:export",
	],

	viewer: [
		// Read-only access
		"documents:read",
		"documents:download",
		"templates:read",
		"signatures:read",
		"analytics:read",
		"reports:read",
	],
};

/**
 * Check if user has specific permission
 */
export function hasPermission(
	member: Doc<"organization_members">,
	permission: string,
): boolean {
	// Check if user is active
	if (member.status !== "active") {
		return false;
	}

	// Get role permissions
	const rolePermissions = ROLE_PERMISSIONS[member.role] || [];

	// Get individual permissions (if any)
	const individualPermissions = member.permissions || [];

	// Check role permission, individual permission, or wildcard
	return (
		rolePermissions.includes(permission) ||
		individualPermissions.includes(permission) ||
		rolePermissions.includes("*")
	);
}

/**
 * Check if user has specific role or higher
 */
export function hasRole(
	member: Doc<"organization_members">,
	requiredRole: OrganizationMemberRole,
): boolean {
	const userLevel = ROLE_HIERARCHY[member.role] || 0;
	const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
	return userLevel >= requiredLevel;
}

/**
 * Check if user can access specific organization
 */
export function canAccessOrganization(
	member: Doc<"organization_members">,
	targetOrgId: string,
): boolean {
	return member.organizationId === targetOrgId;
}

/**
 * Get effective permissions for user (role-based + individual permissions)
 */
export function getEffectivePermissions(
	member: Doc<"organization_members">,
): string[] {
	const rolePermissions = ROLE_PERMISSIONS[member.role] || [];
	const individualPermissions = member.permissions || [];

	// Combine role and individual permissions (remove duplicates)
	return [...new Set([...rolePermissions, ...individualPermissions])];
}

/**
 * Check if user account is in a valid state
 */
export function isAccountValid(member: Doc<"organization_members">): boolean {
	return member.status === "active";
}

/**
 * Get user display name
 */
export function getDisplayName(user: Doc<"users">): string {
	return user.name || user.email || "Unknown User";
}

/**
 * Document signing platform permission constants
 */
export const DOCUMENT_SIGNING_PERMISSIONS = {
	// Organization permissions
	ORG_MANAGE: "org:manage",
	ORG_SETTINGS_READ: "org:settings:read",
	ORG_SETTINGS_UPDATE: "org:settings:update",
	ORG_USERS_READ: "org:users:read",
	ORG_USERS_INVITE: "org:users:invite",
	ORG_USERS_REMOVE: "org:users:remove",
	ORG_USERS_UPDATE_ROLE: "org:users:update_role",

	// Subscription permissions
	SUBSCRIPTION_MANAGE: "subscription:manage",
	SUBSCRIPTION_BILLING_READ: "subscription:billing:read",
	SUBSCRIPTION_BILLING_UPDATE: "subscription:billing:update",

	// Document permissions
	DOCUMENTS_READ: "documents:read",
	DOCUMENTS_CREATE: "documents:create",
	DOCUMENTS_UPDATE: "documents:update",
	DOCUMENTS_DELETE: "documents:delete",
	DOCUMENTS_SEND: "documents:send",
	DOCUMENTS_CANCEL: "documents:cancel",
	DOCUMENTS_DOWNLOAD: "documents:download",

	// Template permissions
	TEMPLATES_READ: "templates:read",
	TEMPLATES_CREATE: "templates:create",
	TEMPLATES_UPDATE: "templates:update",
	TEMPLATES_DELETE: "templates:delete",
	TEMPLATES_USE: "templates:use",

	// Signature permissions
	SIGNATURES_READ: "signatures:read",
	SIGNATURES_DOWNLOAD: "signatures:download",

	// Audit permissions
	AUDIT_READ: "audit:read",
	AUDIT_EXPORT: "audit:export",

	// API permissions
	API_READ: "api:read",
	API_CREATE: "api:create",
	API_DELETE: "api:delete",

	// Webhook permissions
	WEBHOOKS_READ: "webhooks:read",
	WEBHOOKS_CREATE: "webhooks:create",
	WEBHOOKS_UPDATE: "webhooks:update",
	WEBHOOKS_DELETE: "webhooks:delete",

	// Analytics permissions
	ANALYTICS_READ: "analytics:read",
	REPORTS_READ: "reports:read",
	REPORTS_GENERATE: "reports:generate",

	// Data management permissions
	DATA_EXPORT: "data:export",
	DATA_BACKUP: "data:backup",
} as const;

/**
 * Check if user can manage documents
 */
export function canManageDocuments(
	member: Doc<"organization_members">,
	orgId: string,
): boolean {
	// Must have document management permission
	if (!hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_CREATE)) {
		return false;
	}

	// Must be in same organization
	return canAccessOrganization(member, orgId);
}

/**
 * Check if user can send documents for signing
 */
export function canSendDocuments(member: Doc<"organization_members">): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_SEND);
}

/**
 * Check if user can manage templates
 */
export function canManageTemplates(
	member: Doc<"organization_members">,
	orgId: string,
): boolean {
	// Must have template management permission
	if (!hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.TEMPLATES_CREATE)) {
		return false;
	}

	// Must be in same organization
	return canAccessOrganization(member, orgId);
}

/**
 * Check if user can download documents
 */
export function canDownloadDocuments(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_DOWNLOAD);
}

/**
 * Check if user can access signatures
 */
export function canAccessSignatures(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.SIGNATURES_READ);
}

/**
 * Check if user can manage webhooks
 */
export function canManageWebhooks(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.WEBHOOKS_CREATE);
}

/**
 * Check if user can manage API keys
 */
export function canManageAPIKeys(member: Doc<"organization_members">): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.API_CREATE);
}

/**
 * Check if user can access audit logs
 */
export function canAccessAuditLogs(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.AUDIT_READ);
}

/**
 * Check if user can manage subscription/billing
 */
export function canManageSubscription(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(
		member,
		DOCUMENT_SIGNING_PERMISSIONS.SUBSCRIPTION_MANAGE,
	);
}

/**
 * Check if user can manage organization settings
 */
export function canManageOrganization(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_MANAGE);
}

/**
 * Check if user can invite/remove members
 */
export function canManageMembers(member: Doc<"organization_members">): boolean {
	return (
		hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_INVITE) ||
		hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_REMOVE)
	);
}

/**
 * Get user's highest permission level for a specific domain
 */
export function getHighestPermissionLevel(
	member: Doc<"organization_members">,
	domain: "documents" | "templates" | "signatures" | "webhooks" | "api",
): "none" | "read" | "write" | "delete" {
	const permissions = getEffectivePermissions(member);

	if (permissions.includes(`${domain}:delete`)) {
		return "delete";
	}
	if (
		permissions.includes(`${domain}:write`) ||
		permissions.includes(`${domain}:create`) ||
		permissions.includes(`${domain}:update`)
	) {
		return "write";
	}
	if (permissions.includes(`${domain}:read`)) {
		return "read";
	}

	return "none";
}

/**
 * Check if user is an organization owner
 */
export function isOwner(member: Doc<"organization_members">): boolean {
	return member.role === "owner";
}

/**
 * Check if user is an organization admin or higher
 */
export function isAdmin(member: Doc<"organization_members">): boolean {
	return hasRole(member, "admin");
}

/**
 * User type checking functions
 * Note: userType was removed from organization_members schema, defaulting to personal
 */
export function isPersonalUser(_member: Doc<"organization_members">): boolean {
	return true; // Default to personal since userType was removed
}

export function isBusinessUser(_member: Doc<"organization_members">): boolean {
	return false; // Default to false since userType was removed
}

/**
 * Check if user can export data
 */
export function canExportData(member: Doc<"organization_members">): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DATA_EXPORT);
}

/**
 * Check if user can generate reports
 */
export function canGenerateReports(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.REPORTS_GENERATE);
}

/**
 * Check if user can access analytics
 */
export function canAccessAnalytics(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ANALYTICS_READ);
}

/**
 * Check if user can use templates
 */
export function canUseTemplates(member: Doc<"organization_members">): boolean {
	return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.TEMPLATES_USE);
}

/**
 * Check if user has document signing access
 */
export function hasDocumentSigningAccess(
	member: Doc<"organization_members">,
): boolean {
	return (
		hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_READ) ||
		hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.SIGNATURES_READ)
	);
}

/**
 * Utility functions for role and permission checking
 * Grouped for easy import and backward compatibility
 */
export const AuthUtils = {
	// Core auth functions
	hasPermission,
	hasRole,
	canAccessOrganization,
	getEffectivePermissions,
	isAccountValid,
	getDisplayName,

	// User type functions
	isPersonalUser,
	isBusinessUser,
	isOwner,
	isAdmin,

	// Document signing management functions
	canManageDocuments,
	canSendDocuments,
	canManageTemplates,
	canDownloadDocuments,
	canAccessSignatures,
	canManageWebhooks,
	canManageAPIKeys,
	canAccessAuditLogs,
	canManageSubscription,
	canManageOrganization,
	canManageMembers,
	getHighestPermissionLevel,

	// Data and reporting functions
	canExportData,
	canGenerateReports,
	canAccessAnalytics,
	canUseTemplates,
	hasDocumentSigningAccess,

	// Permission constants
	PERMISSIONS: DOCUMENT_SIGNING_PERMISSIONS,
	ROLE_HIERARCHY,
};
