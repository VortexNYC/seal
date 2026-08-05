import type { Doc } from "./_generated/dataModel";
import {
  getExpandedPermissions,
  hasPermission as catalogHasPermission,
} from "./auth/permissions";
import type { OrganizationMemberRole } from "./schema";

export type AuthMember = {
  userId?: string;
  organizationId: string;
  role: OrganizationMemberRole;
  status: string;
  permissions?: string[];
  roleId?: string;
  permissionOverrides?: {
    add?: string[];
    remove?: string[];
  };
};

/**
 * Role hierarchy levels for permission comparison
 * Higher numbers = more permissions
 */
/** Authentication helpers shared by Convex functions. */
/** Authentication helpers shared by Convex functions. */
export const ROLE_HIERARCHY: Record<OrganizationMemberRole, number> = {
  system: 150, // System-level access (highest)
  owner: 100, // Organization owner
  admin: 75, // Organization administrator
  member: 50, // Regular member
  viewer: 25, // Read-only access
};

/**
 * Role → permission grants. Single source: auth/permissions ROLE_TEMPLATES.
 * Keep system as global wildcard for platform operators.
 */
export const ROLE_PERMISSIONS: Record<OrganizationMemberRole, string[]> = {
  system: ["*"],
  owner: getExpandedPermissions("owner"),
  admin: getExpandedPermissions("admin"),
  member: getExpandedPermissions("member"),
  viewer: getExpandedPermissions("viewer"),
};

/** Returns true if the member has the named permission via role or individual grant. */
// Authoritative permission check for a member.
export function hasPermission(member: AuthMember, permission: string): boolean {
  // Check if user is active
  if (member.status !== "active") {
    return false;
  }

  // Get role permissions
  const rolePermissions = ROLE_PERMISSIONS[member.role] || [];

  // Get individual permissions (if any)
  const individualPermissions = member.permissions || [];

  return catalogHasPermission(
    [...rolePermissions, ...individualPermissions],
    permission
  );
}

/**
 * Check if user has specific role or higher
 */
/** Returns true if the member's role is at or above the required level. */
export function hasRole(
  member: AuthMember,
  requiredRole: OrganizationMemberRole
): boolean {
  const userLevel = ROLE_HIERARCHY[member.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  return userLevel >= requiredLevel;
}

/**
 * Check if user can access specific organization
 */
/** Returns true if the member can access the given organization. */
export function canAccessOrganization(
  member: AuthMember,
  targetOrgId: string
): boolean {
  return member.organizationId === targetOrgId;
}

/**
 * Get effective permissions for user (role-based + individual permissions)
 */
/** Returns the union of role permissions and individual permissions for the member. */
export function getEffectivePermissions(member: AuthMember): string[] {
  const rolePermissions = ROLE_PERMISSIONS[member.role] || [];
  const individualPermissions = member.permissions || [];

  // Combine role and individual permissions (remove duplicates)
  return [...new Set([...rolePermissions, ...individualPermissions])];
}

/** Returns true if the member's account is valid (active, not suspended). */
export function isAccountValid(member: AuthMember): boolean {
  return member.status === "active";
}

/** Returns the user's display name (full name when available, else email local-part). */
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

  // Branding permissions
  BRANDING_MANAGE: "branding:manage",

  // Contacts permissions
  CONTACTS_VIEW: "contacts:view",
  CONTACTS_CREATE: "contacts:create",
  CONTACTS_EDIT: "contacts:edit",
  CONTACTS_DELETE: "contacts:delete",
  CONTACTS_EXPORT: "contacts:export",
} as const;

/**
 * Check if user can manage documents
 */
export function canManageDocuments(member: AuthMember, orgId: string): boolean {
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
export function canSendDocuments(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_SEND);
}

/**
 * Check if user can manage templates
 */
export function canManageTemplates(member: AuthMember, orgId: string): boolean {
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
export function canDownloadDocuments(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DOCUMENTS_DOWNLOAD);
}

/**
 * Check if user can access signatures
 */
export function canAccessSignatures(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.SIGNATURES_READ);
}

/**
 * Check if user can manage webhooks
 */
export function canManageWebhooks(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.WEBHOOKS_CREATE);
}

/**
 * Check if user can manage API keys
 */
export function canManageAPIKeys(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.API_CREATE);
}

/**
 * Check if user can access audit logs
 */
export function canAccessAuditLogs(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.AUDIT_READ);
}

/**
 * Check if user can manage subscription/billing
 */
export function canManageSubscription(member: AuthMember): boolean {
  return hasPermission(
    member,
    DOCUMENT_SIGNING_PERMISSIONS.SUBSCRIPTION_MANAGE
  );
}

/**
 * Check if user can manage organization settings
 */
export function canManageOrganization(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_MANAGE);
}

/**
 * Check if user can invite/remove members
 */
export function canManageMembers(member: AuthMember): boolean {
  return (
    hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_INVITE) ||
    hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_REMOVE)
  );
}

/**
 * Get user's highest permission level for a specific domain
 */
export function getHighestPermissionLevel(
  member: AuthMember,
  domain: "documents" | "templates" | "signatures" | "webhooks" | "api"
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
export function isOwner(member: AuthMember): boolean {
  return member.role === "owner";
}

/**
 * Check if user is an organization admin or higher
 */
export function isAdmin(member: AuthMember): boolean {
  return hasRole(member, "admin");
}

/**
 * Check if user is an organization owner or admin
 * Common guard for admin-scoped resources (e.g. visibility-restricted folders)
 */
export function isAdminOrOwner(member: AuthMember): boolean {
  return member.role === "owner" || member.role === "admin";
}

/**
 * User type checking functions
 * Note: userType was removed from organization_members schema, defaulting to personal
 */
/** Returns true if the user account is a personal (non-business) account. */
export function isPersonalUser(_member: AuthMember): boolean {
  return true; // Default to personal since userType was removed
}

export function isBusinessUser(_member: AuthMember): boolean {
  return false; // Default to false since userType was removed
}

/**
 * Check if user can export data
 */
export function canExportData(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.DATA_EXPORT);
}

/**
 * Check if user can generate reports
 */
export function canGenerateReports(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.REPORTS_GENERATE);
}

/**
 * Check if user can access analytics
 */
export function canAccessAnalytics(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.ANALYTICS_READ);
}

/**
 * Check if user can use templates
 */
export function canUseTemplates(member: AuthMember): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.TEMPLATES_USE);
}

/**
 * Check if user has document signing access
 */
export function hasDocumentSigningAccess(member: AuthMember): boolean {
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
  isAdminOrOwner,

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
