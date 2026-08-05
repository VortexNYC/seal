/**
 * Permission definitions and role templates for the Seal application
 *
 * Product catalog (PERMISSIONS + ROLE_TEMPLATES) stays Seal-owned so document
 * signing grants remain product-scoped. Match / expand / intersect logic comes
 * from `@vortexnyc/permissions` — no second hierarchy engine (SEA-602).
 */

import {
  getExpandedPermissions as expandRoleTemplatePermissions,
  hasAllPermissions as coreHasAllPermissions,
  hasAnyPermission as coreHasAnyPermission,
  hasPermission as coreHasPermission,
  type RoleTemplateMap,
} from "@vortexnyc/permissions";

// Master list of all permissions in the system.
// Includes legacy Seal strings so component-seeded roles and RLS gates share
// one catalog (no more webhooks:* vs settings:integrations split-brain).
export const PERMISSIONS = {
  // Organization Management (canonical)
  "organization:view": "View organization details",
  "organization:edit": "Edit organization settings",
  "organization:manage": "Manage organization settings and members",
  "organization:billing": "Manage billing and subscriptions",
  "organization:members": "Manage organization members",
  "organization:invitations": "Send and manage invitations",

  // Organization (legacy org:* aliases still checked by AuthUtils callers)
  "org:manage": "Manage organization (legacy)",
  "org:settings:read": "Read organization settings (legacy)",
  "org:settings:update": "Update organization settings (legacy)",
  "org:users:read": "Read organization users (legacy)",
  "org:users:invite": "Invite organization users (legacy)",
  "org:users:remove": "Remove organization users (legacy)",
  "org:users:update_role": "Update organization user roles (legacy)",

  // Subscription (legacy)
  "subscription:manage": "Manage subscription",
  "subscription:billing:read": "Read billing",
  "subscription:billing:update": "Update billing",

  // Documents
  "documents:view": "View documents",
  "documents:read": "Read documents (legacy alias of view)",
  "documents:create": "Create new documents",
  "documents:edit": "Edit documents",
  "documents:update": "Update documents (legacy alias of edit)",
  "documents:delete": "Delete documents",
  "documents:share": "Share documents",
  "documents:export": "Export documents",
  "documents:send": "Send documents",
  "documents:cancel": "Cancel documents",
  "documents:download": "Download documents",

  // Templates
  "templates:view": "View templates",
  "templates:read": "Read templates", // Alias for view
  "templates:create": "Create templates",
  "templates:edit": "Edit templates",
  "templates:update": "Update templates (legacy alias of edit)",
  "templates:delete": "Delete templates",
  "templates:use": "Use templates",

  // Settings
  "settings:view": "View settings",
  "settings:edit": "Edit settings",
  "settings:integrations": "Manage integrations",

  // Users & Roles
  "users:view": "View users",
  "users:create": "Create users",
  "users:edit": "Edit users",
  "users:delete": "Delete users",
  "users:roles": "Manage user roles",

  // Contacts
  "contacts:view": "View contacts",
  "contacts:create": "Create contacts",
  "contacts:edit": "Edit contacts",
  "contacts:delete": "Delete contacts",
  "contacts:export": "Export contacts",

  // Branding
  "branding:manage": "Manage organization branding settings",

  // Audit
  "audit:view": "View audit logs",
  "audit:read": "Read audit logs (legacy alias of view)",
  "audit:export": "Export audit logs",

  // API & Webhooks (seeded into component roles; webhooks UI gates settings:integrations)
  "api:read": "Read API keys",
  "api:create": "Create API keys",
  "api:delete": "Delete API keys",
  "webhooks:read": "Read webhooks",
  "webhooks:create": "Create webhooks",
  "webhooks:update": "Update webhooks",
  "webhooks:delete": "Delete webhooks",

  // Analytics / reports / data
  "analytics:read": "Read analytics",
  "reports:read": "Read reports",
  "reports:generate": "Generate reports",
  "data:export": "Export data",
  "data:backup": "Backup data",

  // Signatures
  "signatures:read": "Read signatures",
  "signatures:download": "Download signatures",

  // System (Super Admin only)
  "system:super": "Super admin access",
  "system:maintenance": "System maintenance",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

/**
 * Role template definitions
 * Each role has a name, description, and list of permissions
 * Permissions can use wildcards:
 * - "*" grants all permissions
 * - "domain:*" grants all permissions in that domain
 */
export const ROLE_TEMPLATES = {
  owner: {
    name: "Owner",
    description: "Full access to all features including billing",
    permissions: ["*"] as const,
  },
  admin: {
    name: "Administrator",
    description: "Manage all operations except billing",
    permissions: [
      "organization:view",
      "organization:edit",
      "organization:manage",
      "organization:members",
      "organization:invitations",
      "org:*",
      "subscription:billing:read",
      "documents:*",
      "templates:*",
      "contacts:*",
      "settings:*",
      "users:*",
      "branding:manage",
      "audit:*",
      "api:*",
      "webhooks:*",
      "signatures:*",
      "analytics:read",
      "reports:*",
      "data:export",
    ] as const,
  },
  member: {
    name: "Member",
    description: "Create and edit content",
    permissions: [
      "organization:view",
      "documents:view",
      "documents:read",
      "documents:create",
      "documents:edit",
      "documents:update",
      "documents:share",
      "documents:export",
      "documents:send",
      "documents:cancel",
      "documents:download",
      "templates:view",
      "templates:read",
      "templates:use",
      "templates:create",
      "contacts:view",
      "contacts:create",
      "contacts:edit",
      "contacts:export",
      "settings:view",
      "users:view",
      "signatures:read",
      "signatures:download",
      "analytics:read",
      "reports:read",
      "data:export",
    ] as const,
  },
  viewer: {
    name: "Viewer",
    description: "Read-only access to most features",
    permissions: [
      "organization:view",
      "documents:view",
      "documents:read",
      "documents:download",
      "templates:view",
      "templates:read",
      "contacts:view",
      "settings:view",
      "users:view",
      "signatures:read",
      "analytics:read",
      "reports:read",
    ] as const,
  },
} as const;

export type RoleTemplate = keyof typeof ROLE_TEMPLATES;

/** Grant map for Core expanders — metadata stays on ROLE_TEMPLATES. */
const ROLE_PERMISSION_GRANTS: RoleTemplateMap<RoleTemplate> = {
  owner: ROLE_TEMPLATES.owner.permissions,
  admin: ROLE_TEMPLATES.admin.permissions,
  member: ROLE_TEMPLATES.member.permissions,
  viewer: ROLE_TEMPLATES.viewer.permissions,
};

/**
 * Check if a user has a specific permission.
 * Delegates to `@vortexnyc/permissions` (exact / `*` / `domain:*`).
 */
export function hasPermission(
  userPermissions: readonly string[],
  requiredPermission: string
): boolean {
  return coreHasPermission(userPermissions, requiredPermission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(
  userPermissions: readonly string[],
  requiredPermissions: string[]
): boolean {
  return coreHasAnyPermission(userPermissions, requiredPermissions);
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(
  userPermissions: readonly string[],
  requiredPermissions: string[]
): boolean {
  return coreHasAllPermissions(userPermissions, requiredPermissions);
}

/**
 * Validate permission / role keys and expand role templates.
 */
export function isValidPermission(permission: string): boolean {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, permission);
}

export function isPermissionKey(
  permission: string
): permission is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, permission);
}

export function isRoleTemplate(role: string): role is RoleTemplate {
  return Object.prototype.hasOwnProperty.call(ROLE_TEMPLATES, role);
}

function sortedPermissionKeys(
  permissions: Iterable<PermissionKey>
): PermissionKey[] {
  const result: PermissionKey[] = [];
  for (const key of permissions) {
    let insertAt = result.length;
    for (let index = 0; index < result.length; index += 1) {
      const existing = result[index];
      if (existing !== undefined && key < existing) {
        insertAt = index;
        break;
      }
    }
    result.splice(insertAt, 0, key);
  }
  return result;
}

/**
 * Get all expanded permissions for a role template
 * Resolves wildcards via Core against Seal's PERMISSIONS catalog.
 */
export function getExpandedPermissions(role: RoleTemplate): PermissionKey[] {
  const expanded = expandRoleTemplatePermissions(
    PERMISSIONS,
    ROLE_PERMISSION_GRANTS,
    role
  );
  return sortedPermissionKeys(expanded.filter(isPermissionKey));
}

/**
 * Get all permissions organized by domain
 * Useful for UI display
 */
export function getPermissionsByDomain(): Record<
  string,
  Array<{ key: PermissionKey; description: string }>
> {
  const byDomain: Record<
    string,
    Array<{ key: PermissionKey; description: string }>
  > = {};

  for (const key of Object.keys(PERMISSIONS).filter(isPermissionKey)) {
    const [domain] = key.split(":");
    if (domain) {
      if (!byDomain[domain]) {
        byDomain[domain] = [];
      }
      byDomain[domain].push({
        key,
        description: PERMISSIONS[key],
      });
    }
  }

  return byDomain;
}

/**
 * Get the display name and description for a role template
 */
export function getRoleInfo(role: RoleTemplate): {
  name: string;
  description: string;
} {
  return {
    name: ROLE_TEMPLATES[role].name,
    description: ROLE_TEMPLATES[role].description,
  };
}
