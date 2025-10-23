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
 * Financial management permissions for each role
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
		// Financial accounts (full access)
		"accounts:read",
		"accounts:create",
		"accounts:update",
		"accounts:delete",
		"accounts:archive",
		// Transactions (full access)
		"transactions:read",
		"transactions:create",
		"transactions:update",
		"transactions:delete",
		"transactions:import",
		"transactions:export",
		// Categories (full access)
		"categories:read",
		"categories:create",
		"categories:update",
		"categories:delete",
		// Budgets (full access)
		"budgets:read",
		"budgets:create",
		"budgets:update",
		"budgets:delete",
		// Goals (full access)
		"goals:read",
		"goals:create",
		"goals:update",
		"goals:delete",
		// Reports and analytics
		"reports:read",
		"reports:generate",
		"analytics:read",
		// Data management
		"data:export",
		"data:backup",
	],

	admin: [
		// Organization view
		"org:settings:read",
		"org:users:read",
		"org:users:invite",
		"org:users:update_role",
		// Subscription view
		"subscription:billing:read",
		// Financial accounts (manage)
		"accounts:read",
		"accounts:create",
		"accounts:update",
		"accounts:archive",
		// Transactions (manage)
		"transactions:read",
		"transactions:create",
		"transactions:update",
		"transactions:delete",
		"transactions:import",
		"transactions:export",
		// Categories (manage)
		"categories:read",
		"categories:create",
		"categories:update",
		"categories:delete",
		// Budgets (manage)
		"budgets:read",
		"budgets:create",
		"budgets:update",
		"budgets:delete",
		// Goals (manage)
		"goals:read",
		"goals:create",
		"goals:update",
		"goals:delete",
		// Reports
		"reports:read",
		"reports:generate",
		"analytics:read",
		// Data export
		"data:export",
	],

	member: [
		// Basic financial access
		"accounts:read",
		"accounts:create",
		"accounts:update",
		// Transactions
		"transactions:read",
		"transactions:create",
		"transactions:update",
		"transactions:import",
		// Categories (read and personal create)
		"categories:read",
		"categories:create",
		// Budgets
		"budgets:read",
		"budgets:create",
		"budgets:update",
		// Goals
		"goals:read",
		"goals:create",
		"goals:update",
		// Basic reports
		"reports:read",
		"analytics:read",
		// Personal data
		"data:export",
	],

	viewer: [
		// Read-only access
		"accounts:read",
		"transactions:read",
		"categories:read",
		"budgets:read",
		"goals:read",
		"reports:read",
		"analytics:read",
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
 * Financial management permission constants
 */
export const FINANCIAL_PERMISSIONS = {
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

	// Account permissions
	ACCOUNTS_READ: "accounts:read",
	ACCOUNTS_CREATE: "accounts:create",
	ACCOUNTS_UPDATE: "accounts:update",
	ACCOUNTS_DELETE: "accounts:delete",
	ACCOUNTS_ARCHIVE: "accounts:archive",

	// Transaction permissions
	TRANSACTIONS_READ: "transactions:read",
	TRANSACTIONS_CREATE: "transactions:create",
	TRANSACTIONS_UPDATE: "transactions:update",
	TRANSACTIONS_DELETE: "transactions:delete",
	TRANSACTIONS_IMPORT: "transactions:import",
	TRANSACTIONS_EXPORT: "transactions:export",

	// Category permissions
	CATEGORIES_READ: "categories:read",
	CATEGORIES_CREATE: "categories:create",
	CATEGORIES_UPDATE: "categories:update",
	CATEGORIES_DELETE: "categories:delete",

	// Budget permissions
	BUDGETS_READ: "budgets:read",
	BUDGETS_CREATE: "budgets:create",
	BUDGETS_UPDATE: "budgets:update",
	BUDGETS_DELETE: "budgets:delete",

	// Goal permissions
	GOALS_READ: "goals:read",
	GOALS_CREATE: "goals:create",
	GOALS_UPDATE: "goals:update",
	GOALS_DELETE: "goals:delete",

	// Report and analytics permissions
	REPORTS_READ: "reports:read",
	REPORTS_GENERATE: "reports:generate",
	ANALYTICS_READ: "analytics:read",

	// Data management permissions
	DATA_EXPORT: "data:export",
	DATA_BACKUP: "data:backup",
} as const;

/**
 * Check if user can manage financial accounts
 */
export function canManageAccounts(
	member: Doc<"organization_members">,
	orgId: string,
): boolean {
	// Must have account management permission
	if (!hasPermission(member, FINANCIAL_PERMISSIONS.ACCOUNTS_CREATE)) {
		return false;
	}

	// Must be in same organization
	return canAccessOrganization(member, orgId);
}

/**
 * Check if user can create/edit transactions
 */
export function canManageTransactions(
	member: Doc<"organization_members">,
	orgId: string,
): boolean {
	// Must have transaction write permission
	if (!hasPermission(member, FINANCIAL_PERMISSIONS.TRANSACTIONS_CREATE)) {
		return false;
	}

	// Must be in same organization
	return canAccessOrganization(member, orgId);
}

/**
 * Check if user can manage budgets
 */
export function canManageBudgets(
	member: Doc<"organization_members">,
	orgId: string,
): boolean {
	// Must have budget management permission
	if (!hasPermission(member, FINANCIAL_PERMISSIONS.BUDGETS_CREATE)) {
		return false;
	}

	// Must be in same organization
	return canAccessOrganization(member, orgId);
}

/**
 * Check if user can manage goals
 */
export function canManageGoals(
	member: Doc<"organization_members">,
	orgId: string,
): boolean {
	// Must have goal management permission
	if (!hasPermission(member, FINANCIAL_PERMISSIONS.GOALS_CREATE)) {
		return false;
	}

	// Must be in same organization
	return canAccessOrganization(member, orgId);
}

/**
 * Check if user can access financial data
 */
export function canAccessFinancialData(
	member: Doc<"organization_members">,
): boolean {
	return (
		hasPermission(member, FINANCIAL_PERMISSIONS.ACCOUNTS_READ) ||
		hasPermission(member, FINANCIAL_PERMISSIONS.TRANSACTIONS_READ) ||
		hasPermission(member, FINANCIAL_PERMISSIONS.BUDGETS_READ) ||
		hasPermission(member, FINANCIAL_PERMISSIONS.GOALS_READ)
	);
}

/**
 * Check if user can manage subscription/billing
 */
export function canManageSubscription(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, FINANCIAL_PERMISSIONS.SUBSCRIPTION_MANAGE);
}

/**
 * Check if user can manage organization settings
 */
export function canManageOrganization(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, FINANCIAL_PERMISSIONS.ORG_MANAGE);
}

/**
 * Check if user can invite/remove members
 */
export function canManageMembers(member: Doc<"organization_members">): boolean {
	return (
		hasPermission(member, FINANCIAL_PERMISSIONS.ORG_USERS_INVITE) ||
		hasPermission(member, FINANCIAL_PERMISSIONS.ORG_USERS_REMOVE)
	);
}

/**
 * Get user's highest permission level for a specific domain
 */
export function getHighestPermissionLevel(
	member: Doc<"organization_members">,
	domain: "accounts" | "transactions" | "budgets" | "goals" | "categories",
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
	return hasPermission(member, FINANCIAL_PERMISSIONS.DATA_EXPORT);
}

/**
 * Check if user can generate reports
 */
export function canGenerateReports(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, FINANCIAL_PERMISSIONS.REPORTS_GENERATE);
}

/**
 * Check if user can access analytics
 */
export function canAccessAnalytics(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, FINANCIAL_PERMISSIONS.ANALYTICS_READ);
}

/**
 * Check if user can import/export transactions
 */
export function canImportTransactions(
	member: Doc<"organization_members">,
): boolean {
	return hasPermission(member, FINANCIAL_PERMISSIONS.TRANSACTIONS_IMPORT);
}

/**
 * Check if user has financial management access
 */
export function hasFinancialAccess(
	member: Doc<"organization_members">,
): boolean {
	return (
		hasPermission(member, FINANCIAL_PERMISSIONS.ACCOUNTS_READ) ||
		hasPermission(member, FINANCIAL_PERMISSIONS.TRANSACTIONS_READ)
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

	// Financial management functions
	canManageAccounts,
	canManageTransactions,
	canManageBudgets,
	canManageGoals,
	canAccessFinancialData,
	canManageSubscription,
	canManageOrganization,
	canManageMembers,
	getHighestPermissionLevel,

	// Data and reporting functions
	canExportData,
	canGenerateReports,
	canAccessAnalytics,
	canImportTransactions,
	hasFinancialAccess,

	// Permission constants
	PERMISSIONS: FINANCIAL_PERMISSIONS,
	ROLE_HIERARCHY,
};
