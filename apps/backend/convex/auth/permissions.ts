/**
 * Permission definitions and role templates for the Seal application
 *
 * This file defines all available permissions and role templates.
 * Permissions are organized by domain (organization, documents, templates, etc.)
 */

// Master list of all permissions in the system
export const PERMISSIONS = {
  // Organization Management
  "organization:view": "View organization details",
  "organization:edit": "Edit organization settings",
  "organization:manage": "Manage organization settings and members",
  "organization:billing": "Manage billing and subscriptions",
  "organization:members": "Manage organization members",
  "organization:invitations": "Send and manage invitations",

  // Documents
  "documents:view": "View documents",
  "documents:create": "Create new documents",
  "documents:edit": "Edit documents",
  "documents:delete": "Delete documents",
  "documents:share": "Share documents",
  "documents:export": "Export documents",

  // Templates
  "templates:view": "View templates",
  "templates:read": "Read templates", // Alias for view
  "templates:create": "Create templates",
  "templates:edit": "Edit templates",
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
  "audit:export": "Export audit logs",

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
      "documents:*",
      "templates:*",
      "contacts:*",
      "settings:*",
      "users:*",
      "branding:manage",
      "audit:view",
    ] as const,
  },
  member: {
    name: "Member",
    description: "Create and edit content",
    permissions: [
      "organization:view",
      "documents:view",
      "documents:create",
      "documents:edit",
      "documents:share",
      "documents:export",
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
    ] as const,
  },
  viewer: {
    name: "Viewer",
    description: "Read-only access to most features",
    permissions: [
      "organization:view",
      "documents:view",
      "templates:view",
      "templates:read",
      "contacts:view",
      "settings:view",
      "users:view",
    ] as const,
  },
} as const;

export type RoleTemplate = keyof typeof ROLE_TEMPLATES;

/**
 * Check if a user has a specific permission
 * Supports wildcards: '*' for all, 'domain:*' for all in domain
 *
 * @param userPermissions - Array of permissions the user has
 * @param requiredPermission - The permission to check for
 * @returns true if user has the permission
 */
export function hasPermission(
  userPermissions: readonly string[],
  requiredPermission: string,
): boolean {
  // Global wildcard = all permissions
  if (userPermissions.includes("*")) {
    return true;
  }

  // Exact match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Domain wildcard (e.g., "documents:*" covers "documents:view")
  const [domain] = requiredPermission.split(":");
  if (domain && userPermissions.includes(`${domain}:*`)) {
    return true;
  }

  return false;
}

/**
 * Check if a user has any of the specified permissions
 *
 * @param userPermissions - Array of permissions the user has
 * @param requiredPermissions - Array of permissions to check (OR logic)
 * @returns true if user has at least one of the permissions
 */
export function hasAnyPermission(
  userPermissions: readonly string[],
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.some((permission) => hasPermission(userPermissions, permission));
}

/**
 * Check if a user has all of the specified permissions
 *
 * @param userPermissions - Array of permissions the user has
 * @param requiredPermissions - Array of permissions to check (AND logic)
 * @returns true if user has all of the permissions
 */
export function hasAllPermissions(
  userPermissions: readonly string[],
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.every((permission) => hasPermission(userPermissions, permission));
}

/**
 * Get all expanded permissions for a role template
 * Resolves wildcards to actual permissions
 *
 * @param role - The role template to expand
 * @returns Array of all permissions for that role
 */
export function getExpandedPermissions(role: RoleTemplate): PermissionKey[] {
  const template = ROLE_TEMPLATES[role];
  const permissions = new Set<PermissionKey>();

  for (const perm of template.permissions) {
    if (perm === "*") {
      // Add all permissions
      for (const key of Object.keys(PERMISSIONS)) {
        permissions.add(key as PermissionKey);
      }
    } else if (perm.endsWith(":*")) {
      // Add all permissions in domain
      const domain = perm.slice(0, -2);
      for (const key of Object.keys(PERMISSIONS)) {
        if (key.startsWith(`${domain}:`)) {
          permissions.add(key as PermissionKey);
        }
      }
    } else {
      // Add specific permission
      if (perm in PERMISSIONS) {
        permissions.add(perm as PermissionKey);
      }
    }
  }

  return Array.from(permissions).sort();
}

/**
 * Check if a permission string is valid
 *
 * @param permission - The permission string to validate
 * @returns true if the permission exists in PERMISSIONS
 */
export function isValidPermission(permission: string): boolean {
  return permission in PERMISSIONS;
}

/**
 * Get all permissions organized by domain
 * Useful for UI display
 *
 * @returns Object with domain names as keys and permission arrays as values
 */
export function getPermissionsByDomain(): Record<
  string,
  Array<{ key: PermissionKey; description: string }>
> {
  const byDomain: Record<string, Array<{ key: PermissionKey; description: string }>> = {};

  for (const [key, description] of Object.entries(PERMISSIONS)) {
    const [domain] = key.split(":");
    if (domain) {
      if (!byDomain[domain]) {
        byDomain[domain] = [];
      }
      byDomain[domain].push({
        key: key as PermissionKey,
        description,
      });
    }
  }

  return byDomain;
}

/**
 * Get the display name and description for a role template
 *
 * @param role - The role template
 * @returns Object with name and description
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
