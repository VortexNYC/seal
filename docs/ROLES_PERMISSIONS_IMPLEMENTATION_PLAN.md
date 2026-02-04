# Roles & Permissions Implementation Plan for Seal

This document provides a comprehensive plan to implement the catapult-vite roles and permissions system into the seal project. The plan is organized by implementation phase and includes specific file changes, code examples, and testing strategies.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [Implementation Phases](#implementation-phases)
4. [Detailed Changes by Component](#detailed-changes-by-component)
5. [Migration Strategy](#migration-strategy)
6. [Testing Plan](#testing-plan)
7. [Rollout Strategy](#rollout-strategy)

---

## Current State Analysis

### What Seal Already Has

**✅ Database Schema (Partially Ready)**

- `convex/organizations/schema.ts` - Organization table with type field
- `convex/organization_members/schema.ts` - Members table with role and status fields
- `convex/users/schema.ts` - Users table with activeOrganization tracking

**✅ Authentication**

- Clerk integration via ClerkProvider
- Convex auth with JWT tokens
- `convex/auth/auth.utils.ts` - Basic auth context with `getAuthContext()`

**✅ Frontend Auth**

- Protected routes via TanStack Router
- SignedIn/SignedOut components
- `apps/web/src/hooks/use-current-user.ts` - User query hook

**⚠️ Permissions System (Minimal)**

- Basic role strings in organization_members (no enforcement)
- Document-level access control (but no granular org permissions)
- No permission validation on mutations/queries
- No frontend permission checks

### What's Missing from Catapult-Vite System

**❌ Permission Definitions**

- No centralized permission constants
- No role template definitions
- No permission-to-role mappings

**❌ Backend Enforcement**

- No query/mutation wrappers with permission checks
- No guard functions for role validation
- No permission resolution in auth context

**❌ Custom Roles**

- No organization_roles table
- No custom role CRUD operations
- No role assignment UI

**❌ Permission Overrides**

- No add/remove permission overrides per member
- No granular permission management

**❌ Frontend Permission Checks**

- No PermissionGate component
- No useHasPermission hook
- No role-based UI rendering

---

## Target Architecture

### Core Principles from Catapult-Vite

1. **Layered Enforcement**: Permissions checked at Convex wrapper level before handler execution
2. **Single Source of Truth**: All permissions defined in `convex/auth/permissions.ts`
3. **Wildcard Support**: `*` for all permissions, `domain:*` for domain-level permissions
4. **Multi-Source Resolution**: Template + custom role + overrides
5. **Organization Scoping**: All queries auto-scoped to user's organization

### System Flow

```
User Request
    ↓
Clerk Authentication (JWT)
    ↓
Load User from DB (by clerkId)
    ↓
Check isSuperAdmin? → YES: return ["*"]
    ↓ NO
Load Membership (by userId + organizationId)
    ↓
Validate Status = "active"
    ↓
Validate Organization status = "active"
    ↓
┌────────────────────┐
│  Resolve Permissions │
│  1. Custom Role?   │
│     ├─ Load org_role.permissions
│     └─ Expand wildcards
│  2. OR Role Template
│     └─ getExpandedPermissions()
│  3. Apply Overrides
│     ├─ Add extra permissions
│     └─ Remove specific permissions
│  4. Deduplicate & Sort
└────────────────────┘
    ↓
Return AuthContextWithPermissions
    ↓
Permission Wrapper Checks Required Permission
    ↓
Execute Handler (if authorized)
```

---

## Implementation Phases

### Phase 0: Preparation (No Code Changes)

**Duration**: 1 day

- [x] Document catapult-vite system architecture
- [x] Document seal current state
- [ ] Review and approve this implementation plan
- [ ] Create Linear tickets for each phase
- [ ] Set up feature branch: `feature/roles-permissions`

---

### Phase 1: Core Permission System (Backend Foundation)

**Duration**: 3-4 days

**Goal**: Implement permission definitions, role templates, and helper functions

#### 1.1 Create Permission Definitions

**File**: `convex/auth/permissions.ts` (NEW)

```typescript
// Permission definitions organized by domain
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

  // Audit
  "audit:view": "View audit logs",
  "audit:export": "Export audit logs",

  // System (Super Admin)
  "system:super": "Super admin access",
  "system:maintenance": "System maintenance",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// Role template definitions
export const ROLE_TEMPLATES = {
  owner: {
    name: "Owner",
    description: "Full access to all features",
    permissions: ["*"] as const,
  },
  admin: {
    name: "Administrator",
    description: "Manage all operations except billing",
    permissions: [
      "organization:view",
      "organization:edit",
      "organization:manage",
      "documents:*",
      "templates:*",
      "settings:*",
      "users:*",
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
      "templates:view",
      "templates:use",
      "settings:view",
      "users:view",
    ] as const,
  },
  viewer: {
    name: "Viewer",
    description: "Read-only access",
    permissions: [
      "organization:view",
      "documents:view",
      "templates:view",
      "settings:view",
      "users:view",
    ] as const,
  },
} as const;

export type RoleTemplate = keyof typeof ROLE_TEMPLATES;

// Helper functions
export function hasPermission(
  userPermissions: readonly string[],
  requiredPermission: string,
): boolean {
  if (userPermissions.includes("*")) return true;
  if (userPermissions.includes(requiredPermission)) return true;

  const [domain] = requiredPermission.split(":");
  if (domain && userPermissions.includes(`${domain}:*`)) return true;

  return false;
}

export function hasAnyPermission(
  userPermissions: readonly string[],
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.some((p) => hasPermission(userPermissions, p));
}

export function hasAllPermissions(
  userPermissions: readonly string[],
  requiredPermissions: string[],
): boolean {
  return requiredPermissions.every((p) => hasPermission(userPermissions, p));
}

export function getExpandedPermissions(role: RoleTemplate): PermissionKey[] {
  const template = ROLE_TEMPLATES[role];
  const permissions = new Set<PermissionKey>();

  for (const perm of template.permissions) {
    if (perm === "*") {
      for (const key of Object.keys(PERMISSIONS)) {
        permissions.add(key as PermissionKey);
      }
    } else if (perm.endsWith(":*")) {
      const domain = perm.slice(0, -2);
      for (const key of Object.keys(PERMISSIONS)) {
        if (key.startsWith(`${domain}:`)) {
          permissions.add(key as PermissionKey);
        }
      }
    } else if (perm in PERMISSIONS) {
      permissions.add(perm as PermissionKey);
    }
  }

  return Array.from(permissions);
}

export function isValidPermission(permission: string): boolean {
  return permission in PERMISSIONS;
}
```

**Tests**: `convex/auth/permissions.test.ts`

---

#### 1.2 Update Database Schema

**File**: `convex/organization_members/schema.ts`

Add permission overrides field:

```typescript
export const organizationMemberTable = defineTable({
  // ... existing fields ...

  // NEW: Fine-grained permission overrides
  permissionOverrides: v.optional(
    v.object({
      add: v.optional(v.array(v.string())), // Additional permissions
      remove: v.optional(v.array(v.string())), // Remove specific permissions
    }),
  ),
});
```

**File**: `convex/organizations/schema.ts`

Add status field:

```typescript
export const organizationTable = defineTable({
  // ... existing fields ...

  // NEW: Organization status
  status: v.union(v.literal("active"), v.literal("suspended"), v.literal("deleted")),
});
```

**File**: `convex/users/schema.ts`

Add super admin flag:

```typescript
export const userTable = defineTable({
  // ... existing fields ...

  // NEW: Super admin flag
  isSuperAdmin: v.optional(v.boolean()),
});
```

**NEW File**: `convex/organization_roles/schema.ts`

```typescript
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const organizationRolesTable = defineTable({
  name: v.string(),
  permissions: v.array(v.string()),
  organizationId: v.id("organizations"),
  type: v.union(v.literal("system"), v.literal("custom")),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_name", ["organizationId", "name"])
  .index("by_type", ["type"]);
```

**File**: `convex/schema.ts`

Import and add the new table:

```typescript
import { organizationRolesTable } from "./organization_roles/schema";

export default defineSchema({
  // ... existing tables ...
  organization_roles: organizationRolesTable,
});
```

---

#### 1.3 Enhanced Auth Context

**File**: `convex/auth/auth.utils.ts`

Update `getAuthContext` to include permissions:

```typescript
import {
  ROLE_TEMPLATES,
  getExpandedPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  type RoleTemplate,
} from "./permissions";

export interface AuthContextWithPermissions {
  userId: Id<"users">;
  organizationId: Id<"organizations">;
  email?: string;
  name?: string;
  role: string;
  permissions: string[];
  isOwner: boolean;
  isAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

export async function getAuthContextWithPermissions(
  ctx: QueryCtx | MutationCtx,
): Promise<AuthContextWithPermissions> {
  // Step 1: Get Clerk identity
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  // Step 2: Load user
  const clerkUserId = identity.subject;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
    .first();

  if (!user) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "User not found",
    });
  }

  // Step 3: Check super admin
  if (user.isSuperAdmin) {
    return {
      userId: user._id,
      organizationId: "" as Id<"organizations">,
      email: user.email,
      name: user.name,
      role: "super_admin",
      permissions: ["*"],
      isOwner: true,
      isAdmin: true,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    };
  }

  // Step 4: Get active organization
  if (!user.activeOrganization) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "No active organization",
    });
  }

  // Step 5: Load membership
  const membership = await ctx.db
    .query("organization_members")
    .withIndex("by_user_and_org", (q) =>
      q.eq("userId", user._id).eq("organizationId", user.activeOrganization),
    )
    .first();

  if (!membership) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Not a member of active organization",
    });
  }

  // Step 6: Validate status
  if (membership.status !== "active") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Membership is ${membership.status}`,
    });
  }

  // Step 7: Load organization
  const organization = await ctx.db.get(user.activeOrganization);
  if (!organization) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Organization not found",
    });
  }

  if (organization.status !== "active") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: `Organization is ${organization.status}`,
    });
  }

  // Step 8: Resolve permissions
  let permissions: string[] = [];

  // 8a. From custom role if assigned
  if (membership.roleId) {
    const role = await ctx.db.get(membership.roleId);
    if (role) {
      permissions = role.permissions.filter(isValidPermission);
    } else {
      // Fallback to template
      permissions = getExpandedPermissions(membership.role as RoleTemplate);
    }
  } else {
    // Use role template
    permissions = getExpandedPermissions(membership.role as RoleTemplate);
  }

  // 8b. Apply overrides
  if (membership.permissionOverrides) {
    if (membership.permissionOverrides.add) {
      permissions = [...permissions, ...membership.permissionOverrides.add];
    }
    if (membership.permissionOverrides.remove) {
      const removeSet = new Set(membership.permissionOverrides.remove);
      permissions = permissions.filter((p) => !removeSet.has(p));
    }
  }

  // Deduplicate and sort
  permissions = Array.from(new Set(permissions)).sort();

  const isOwner = membership.role === "owner";
  const isAdmin = ["owner", "admin"].includes(membership.role);

  return {
    userId: user._id,
    organizationId: user.activeOrganization,
    email: user.email,
    name: user.name,
    role: membership.role,
    permissions,
    isOwner,
    isAdmin,
    hasPermission: (permission: string) => hasPermission(permissions, permission),
    hasAnyPermission: (perms: string[]) => hasAnyPermission(permissions, perms),
    hasAllPermissions: (perms: string[]) => hasAllPermissions(permissions, perms),
  };
}
```

---

### Phase 2: Query/Mutation Wrappers (Backend Enforcement)

**Duration**: 2-3 days

**Goal**: Create reusable wrappers that automatically check permissions

#### 2.1 Permission Wrappers

**File**: `convex/auth/wrappers.ts` (NEW)

```typescript
import { customQuery, customMutation } from "convex-helpers/server/customFunctions";
import { query, mutation } from "../_generated/server";
import { ConvexError } from "convex/values";
import { getAuthContextWithPermissions } from "./auth.utils";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "./permissions";

// Basic authenticated query (no permission check)
export const authQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContextWithPermissions(ctx);
    return { auth };
  }),
);

// Single permission required
export const permissionQuery = (requiredPermission: string) =>
  customQuery(
    query,
    customCtx(async (ctx) => {
      const auth = await getAuthContextWithPermissions(ctx);

      if (!auth.hasPermission(requiredPermission)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: `Insufficient permissions: ${requiredPermission} required`,
          permission: requiredPermission,
        });
      }

      return { auth };
    }),
  );

// Any of multiple permissions
export const permissionAnyQuery = (requiredPermissions: string[]) =>
  customQuery(
    query,
    customCtx(async (ctx) => {
      const auth = await getAuthContextWithPermissions(ctx);

      if (!auth.hasAnyPermission(requiredPermissions)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: `Insufficient permissions: one of [${requiredPermissions.join(", ")}] required`,
          permissions: requiredPermissions,
        });
      }

      return { auth };
    }),
  );

// All permissions required
export const permissionAllQuery = (requiredPermissions: string[]) =>
  customQuery(
    query,
    customCtx(async (ctx) => {
      const auth = await getAuthContextWithPermissions(ctx);

      if (!auth.hasAllPermissions(requiredPermissions)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: `Insufficient permissions: all of [${requiredPermissions.join(", ")}] required`,
          permissions: requiredPermissions,
        });
      }

      return { auth };
    }),
  );

// Admin only
export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContextWithPermissions(ctx);

    if (!auth.isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Admin privileges required",
      });
    }

    return { auth };
  }),
);

// Owner only
export const ownerQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContextWithPermissions(ctx);

    if (!auth.isOwner) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Owner privileges required",
      });
    }

    return { auth };
  }),
);

// === MUTATIONS ===

export const authMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuthContextWithPermissions(ctx);
    return { auth };
  }),
);

export const permissionMutation = (requiredPermission: string) =>
  customMutation(
    mutation,
    customCtx(async (ctx) => {
      const auth = await getAuthContextWithPermissions(ctx);

      if (!auth.hasPermission(requiredPermission)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: `Insufficient permissions: ${requiredPermission} required`,
          permission: requiredPermission,
        });
      }

      return { auth };
    }),
  );

export const permissionAnyMutation = (requiredPermissions: string[]) =>
  customMutation(
    mutation,
    customCtx(async (ctx) => {
      const auth = await getAuthContextWithPermissions(ctx);

      if (!auth.hasAnyPermission(requiredPermissions)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: `Insufficient permissions: one of [${requiredPermissions.join(", ")}] required`,
          permissions: requiredPermissions,
        });
      }

      return { auth };
    }),
  );

export const permissionAllMutation = (requiredPermissions: string[]) =>
  customMutation(
    mutation,
    customCtx(async (ctx) => {
      const auth = await getAuthContextWithPermissions(ctx);

      if (!auth.hasAllPermissions(requiredPermissions)) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: `Insufficient permissions: all of [${requiredPermissions.join(", ")}] required`,
          permissions: requiredPermissions,
        });
      }

      return { auth };
    }),
  );

export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuthContextWithPermissions(ctx);

    if (!auth.isAdmin) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Admin privileges required",
      });
    }

    return { auth };
  }),
);

export const ownerMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const auth = await getAuthContextWithPermissions(ctx);

    if (!auth.isOwner) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Owner privileges required",
      });
    }

    return { auth };
  }),
);
```

---

#### 2.2 Guard Functions

**File**: `convex/auth/guards.ts` (NEW)

```typescript
import { ConvexError } from "convex/values";
import type { AuthContextWithPermissions } from "./auth.utils";
import type { Id } from "../_generated/dataModel";

export function ensureOwner(auth: AuthContextWithPermissions): void {
  if (!auth.isOwner) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Owner privileges required",
    });
  }
}

export function ensureAdmin(auth: AuthContextWithPermissions): void {
  if (!auth.isAdmin) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin privileges required",
    });
  }
}

export function ensureOrganizationScope(
  auth: AuthContextWithPermissions,
  targetOrgId?: Id<"organizations">,
): void {
  if (targetOrgId && targetOrgId !== auth.organizationId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Organization scope mismatch",
    });
  }
}

export function ensureAdminForOrg(
  auth: AuthContextWithPermissions,
  targetOrgId?: Id<"organizations">,
): void {
  ensureAdmin(auth);
  ensureOrganizationScope(auth, targetOrgId);
}
```

---

### Phase 3: Apply Wrappers to Existing Endpoints

**Duration**: 2-3 days

**Goal**: Migrate all existing queries/mutations to use permission wrappers

#### Example Migrations

**File**: `convex/documents/queries.ts`

Before:

```typescript
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    // ... manual auth checks
    return documents;
  },
});
```

After:

```typescript
import { permissionQuery } from "../auth/wrappers";

export const list = permissionQuery("documents:view")({
  args: {},
  handler: async (ctx) => {
    // ctx.auth is automatically available with permissions
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organizationId))
      .collect();
    return documents;
  },
});
```

**File**: `convex/documents/mutations.ts`

```typescript
import { permissionMutation } from "../auth/wrappers";

export const create = permissionMutation("documents:create")({
  args: {
    title: v.string(),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      organizationId: ctx.auth.organizationId,
      createdBy: ctx.auth.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { id };
  },
});

export const update = permissionMutation("documents:edit")({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Document not found",
      });
    }

    // Ensure org scoping
    if (document.organizationId !== ctx.auth.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot access document from different organization",
      });
    }

    await ctx.db.patch(args.id, {
      title: args.title,
      content: args.content,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const remove = permissionMutation("documents:delete")({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Document not found",
      });
    }

    if (document.organizationId !== ctx.auth.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot delete document from different organization",
      });
    }

    await ctx.db.delete(args.id);
    return { ok: true };
  },
});
```

**Migration Checklist**:

- [ ] `convex/documents/queries.ts`
- [ ] `convex/documents/mutations.ts`
- [ ] `convex/organizations/queries.ts`
- [ ] `convex/organizations/mutations.ts`
- [ ] `convex/organization_members/queries.ts`
- [ ] `convex/organization_members/mutations.ts`
- [ ] `convex/organization_invitations/queries.ts`
- [ ] `convex/organization_invitations/mutations.ts`
- [ ] `convex/templates/queries.ts`
- [ ] `convex/templates/mutations.ts`

---

### Phase 4: Custom Roles Management

**Duration**: 2-3 days

**Goal**: Allow organizations to create custom roles

#### 4.1 Role Queries

**File**: `convex/organization_roles/queries.ts` (NEW)

```typescript
import { v } from "convex/values";
import { permissionQuery } from "../auth/wrappers";

export const list = permissionQuery("users:roles")({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db
      .query("organization_roles")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organizationId))
      .collect();
    return roles;
  },
});

export const getById = permissionQuery("users:roles")({
  args: { id: v.id("organization_roles") },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.id);
    if (!role) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    if (role.organizationId !== ctx.auth.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot access role from different organization",
      });
    }

    return role;
  },
});
```

---

#### 4.2 Role Mutations

**File**: `convex/organization_roles/mutations.ts` (NEW)

```typescript
import { v } from "convex/values";
import { permissionMutation } from "../auth/wrappers";
import { isValidPermission } from "../auth/permissions";

export const create = permissionMutation("users:roles")({
  args: {
    name: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate permissions
    const validPermissions = Array.from(new Set(args.permissions.filter(isValidPermission)));

    // Check for duplicate name
    const existing = await ctx.db
      .query("organization_roles")
      .withIndex("by_name", (q) =>
        q.eq("organizationId", ctx.auth.organizationId).eq("name", args.name),
      )
      .first();

    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Role name already exists",
      });
    }

    const id = await ctx.db.insert("organization_roles", {
      name: args.name,
      permissions: validPermissions,
      organizationId: ctx.auth.organizationId,
      type: "custom",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { roleId: id };
  },
});

export const update = permissionMutation("users:roles")({
  args: {
    roleId: v.id("organization_roles"),
    name: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    if (role.organizationId !== ctx.auth.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot modify role from different organization",
      });
    }

    if (role.type === "system") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot modify system role",
      });
    }

    const updates: any = { updatedAt: Date.now() };

    if (args.name) {
      // Check for duplicate
      const duplicate = await ctx.db
        .query("organization_roles")
        .withIndex("by_name", (q) =>
          q.eq("organizationId", ctx.auth.organizationId).eq("name", args.name),
        )
        .first();

      if (duplicate && duplicate._id !== args.roleId) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "Role name already exists",
        });
      }

      updates.name = args.name;
    }

    if (args.permissions) {
      updates.permissions = Array.from(new Set(args.permissions.filter(isValidPermission)));
    }

    await ctx.db.patch(args.roleId, updates);
    return { ok: true };
  },
});

export const remove = permissionMutation("users:roles")({
  args: { roleId: v.id("organization_roles") },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId);
    if (!role) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Role not found",
      });
    }

    if (role.organizationId !== ctx.auth.organizationId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot delete role from different organization",
      });
    }

    if (role.type === "system") {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot delete system role",
      });
    }

    // Check if assigned to members
    const assigned = await ctx.db
      .query("organization_members")
      .withIndex("by_organization_id", (q) => q.eq("organizationId", ctx.auth.organizationId))
      .filter((q) => q.eq(q.field("roleId"), args.roleId))
      .first();

    if (assigned) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "Role is assigned to members. Reassign members first.",
      });
    }

    await ctx.db.delete(args.roleId);
    return { ok: true };
  },
});
```

---

### Phase 5: Frontend Permission Checks

**Duration**: 3-4 days

**Goal**: Implement UI components and hooks for permission-based rendering

#### 5.1 User Permissions Query

**File**: `convex/auth/queries.ts`

Add a new query to fetch current user's permissions:

```typescript
import { authQuery } from "./wrappers";

export const getUserPermissions = authQuery({
  args: {},
  handler: async (ctx) => {
    return {
      userId: ctx.auth.userId,
      organizationId: ctx.auth.organizationId,
      role: ctx.auth.role,
      permissions: ctx.auth.permissions,
      isOwner: ctx.auth.isOwner,
      isAdmin: ctx.auth.isAdmin,
    };
  },
});
```

---

#### 5.2 Permission Hook

**File**: `apps/web/src/hooks/use-permissions.ts` (NEW)

```typescript
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export function usePermissions() {
  const data = useQuery(api.auth.queries.getUserPermissions);

  const hasPermission = (permission: string): boolean => {
    if (!data) return false;

    // Check wildcard
    if (data.permissions.includes("*")) return true;

    // Check exact match
    if (data.permissions.includes(permission)) return true;

    // Check domain wildcard
    const [domain] = permission.split(":");
    if (domain && data.permissions.includes(`${domain}:*`)) return true;

    return false;
  };

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!data) return false;
    return permissions.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    if (!data) return false;
    return permissions.every((p) => hasPermission(p));
  };

  return {
    permissions: data?.permissions || [],
    role: data?.role,
    isOwner: data?.isOwner || false,
    isAdmin: data?.isAdmin || false,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isLoading: data === undefined,
  };
}
```

---

#### 5.3 PermissionGate Component

**File**: `apps/web/src/components/permission-gate.tsx` (NEW)

```typescript
import type { ReactNode } from "react";
import { usePermissions } from "../hooks/use-permissions";

interface PermissionGateProps {
  children: ReactNode;
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  fallback?: ReactNode;
  requireOwner?: boolean;
  requireAdmin?: boolean;
}

export function PermissionGate({
  children,
  permission,
  anyOf,
  allOf,
  fallback = null,
  requireOwner,
  requireAdmin,
}: PermissionGateProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOwner,
    isAdmin,
    isLoading,
  } = usePermissions();

  if (isLoading) {
    return fallback;
  }

  // Check role requirements
  if (requireOwner && !isOwner) {
    return fallback;
  }

  if (requireAdmin && !isAdmin) {
    return fallback;
  }

  // Check permission requirements
  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  if (anyOf && !hasAnyPermission(anyOf)) {
    return fallback;
  }

  if (allOf && !hasAllPermissions(allOf)) {
    return fallback;
  }

  return <>{children}</>;
}
```

**Usage Examples**:

```typescript
// Single permission
<PermissionGate permission="documents:create">
  <Button>Create Document</Button>
</PermissionGate>

// Any of multiple
<PermissionGate anyOf={["documents:edit", "documents:delete"]}>
  <DropdownMenu />
</PermissionGate>

// All required
<PermissionGate allOf={["documents:edit", "documents:share"]}>
  <ShareButton />
</PermissionGate>

// Role-based
<PermissionGate requireAdmin>
  <AdminPanel />
</PermissionGate>

// With fallback
<PermissionGate
  permission="documents:create"
  fallback={<Button disabled>Create Document</Button>}
>
  <Button>Create Document</Button>
</PermissionGate>
```

---

#### 5.4 Update Existing Components

**File**: `apps/web/src/components/app-sidebar.tsx`

Add permission checks to navigation items:

```typescript
import { PermissionGate } from "./permission-gate";

export function AppSidebar() {
  return (
    <Sidebar>
      {/* ... */}

      <PermissionGate permission="documents:view">
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link to="/$slug/documents" params={{ slug }}>
              Documents
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </PermissionGate>

      <PermissionGate permission="templates:view">
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link to="/$slug/templates" params={{ slug }}>
              Templates
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </PermissionGate>

      <PermissionGate permission="settings:view">
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link to="/$slug/settings" params={{ slug }}>
              Settings
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </PermissionGate>

      {/* ... */}
    </Sidebar>
  );
}
```

---

### Phase 6: Role Management UI

**Duration**: 3-4 days

**Goal**: Build admin UI for managing roles and member permissions

#### 6.1 Role List Page

**File**: `apps/web/src/routes/_authenticated/$slug/settings/roles.tsx` (NEW)

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/permission-gate";
import { RoleCard } from "@/components/roles/role-card";
import { CreateRoleDialog } from "@/components/roles/create-role-dialog";

export default function RolesPage() {
  const roles = useQuery(api.organization_roles.queries.list);
  const deleteRole = useMutation(api.organization_roles.mutations.remove);

  return (
    <PermissionGate permission="users:roles">
      <div className="container py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <CreateRoleDialog />
        </div>

        <div className="grid gap-4">
          {roles?.map((role) => (
            <RoleCard
              key={role._id}
              role={role}
              onDelete={() => deleteRole({ roleId: role._id })}
            />
          ))}
        </div>
      </div>
    </PermissionGate>
  );
}
```

---

#### 6.2 Role Card Component

**File**: `apps/web/src/components/roles/role-card.tsx` (NEW)

```typescript
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit } from "lucide-react";

interface RoleCardProps {
  role: {
    _id: string;
    name: string;
    permissions: string[];
    type: "system" | "custom";
  };
  onDelete: () => void;
}

export function RoleCard({ role, onDelete }: RoleCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              {role.name}
              {role.type === "system" && (
                <Badge variant="secondary">System</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {role.permissions.length} permissions
            </CardDescription>
          </div>
          {role.type === "custom" && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {role.permissions.map((perm) => (
            <Badge key={perm} variant="outline">
              {perm}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

#### 6.3 Create Role Dialog

**File**: `apps/web/src/components/roles/create-role-dialog.tsx` (NEW)

```typescript
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { PERMISSIONS } from "../../../../../convex/auth/permissions";

export function CreateRoleDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const createRole = useMutation(api.organization_roles.mutations.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRole({ name, permissions: selectedPermissions });
    setOpen(false);
    setName("");
    setSelectedPermissions([]);
  };

  const togglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission],
    );
  };

  // Group permissions by domain
  const permissionsByDomain = Object.entries(PERMISSIONS).reduce(
    (acc, [key, description]) => {
      const [domain] = key.split(":");
      if (!acc[domain]) acc[domain] = [];
      acc[domain].push({ key, description });
      return acc;
    },
    {} as Record<string, Array<{ key: string; description: string }>>,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Custom Role</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Content Editor"
                required
              />
            </div>

            <div>
              <Label>Permissions</Label>
              <div className="mt-2 space-y-4">
                {Object.entries(permissionsByDomain).map(([domain, perms]) => (
                  <div key={domain} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 capitalize">{domain}</h4>
                    <div className="space-y-2">
                      {perms.map(({ key, description }) => (
                        <div key={key} className="flex items-center gap-2">
                          <Checkbox
                            id={key}
                            checked={selectedPermissions.includes(key)}
                            onCheckedChange={() => togglePermission(key)}
                          />
                          <label
                            htmlFor={key}
                            className="text-sm cursor-pointer flex-1"
                          >
                            <span className="font-mono text-xs text-muted-foreground">
                              {key}
                            </span>
                            <span className="ml-2">{description}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name || selectedPermissions.length === 0}>
              Create Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Phase 7: Member Role Assignment UI

**Duration**: 2-3 days

**Goal**: Allow admins to assign roles to members

#### 7.1 Update Member Management

**File**: `apps/web/src/routes/_authenticated/$slug/settings/team.tsx`

Add role assignment UI to the existing team page:

```typescript
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { RoleSelect } from "@/components/members/role-select";

// ... existing imports ...

export default function TeamPage() {
  const members = useQuery(api.organization_members.queries.list);
  const roles = useQuery(api.organization_roles.queries.list);
  const updateRole = useMutation(api.organization_members.mutations.updateRole);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Team Members</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members?.map((member) => (
            <TableRow key={member._id}>
              <TableCell>{member.user?.name}</TableCell>
              <TableCell>{member.user?.email}</TableCell>
              <TableCell>
                <PermissionGate permission="organization:manage">
                  <RoleSelect
                    value={member.role}
                    roles={roles}
                    onChange={(role) =>
                      updateRole({
                        memberId: member._id,
                        role,
                      })
                    }
                  />
                </PermissionGate>
                <PermissionGate
                  permission="organization:manage"
                  fallback={<Badge>{member.role}</Badge>}
                />
              </TableCell>
              <TableCell>
                <Badge variant={member.status === "active" ? "default" : "secondary"}>
                  {member.status}
                </Badge>
              </TableCell>
              <TableCell>
                {/* ... actions ... */}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

#### 7.2 Role Select Component

**File**: `apps/web/src/components/members/role-select.tsx` (NEW)

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_TEMPLATES } from "../../../../../convex/auth/permissions";

interface RoleSelectProps {
  value: string;
  roles?: Array<{ _id: string; name: string }>;
  onChange: (role: string) => void;
}

export function RoleSelect({ value, roles, onChange }: RoleSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="owner">Owner</SelectItem>
        <SelectItem value="admin">Admin</SelectItem>
        <SelectItem value="member">Member</SelectItem>
        <SelectItem value="viewer">Viewer</SelectItem>

        {roles && roles.length > 0 && (
          <>
            <SelectSeparator />
            <SelectLabel>Custom Roles</SelectLabel>
            {roles.map((role) => (
              <SelectItem key={role._id} value={role._id}>
                {role.name}
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
```

---

### Phase 8: Testing & Documentation

**Duration**: 2-3 days

**Goal**: Comprehensive testing and documentation

#### 8.1 Backend Tests

**File**: `convex/auth/permissions.test.ts` (NEW)

```typescript
import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getExpandedPermissions,
} from "./permissions";

describe("Permission System", () => {
  describe("hasPermission", () => {
    it("should grant access with wildcard", () => {
      expect(hasPermission(["*"], "documents:view")).toBe(true);
    });

    it("should grant access with exact match", () => {
      expect(hasPermission(["documents:view"], "documents:view")).toBe(true);
    });

    it("should grant access with domain wildcard", () => {
      expect(hasPermission(["documents:*"], "documents:view")).toBe(true);
      expect(hasPermission(["documents:*"], "documents:create")).toBe(true);
    });

    it("should deny access without permission", () => {
      expect(hasPermission(["documents:view"], "documents:create")).toBe(false);
    });
  });

  describe("getExpandedPermissions", () => {
    it("should expand owner to all permissions", () => {
      const perms = getExpandedPermissions("owner");
      expect(perms.length).toBeGreaterThan(0);
      expect(perms).toContain("documents:view");
      expect(perms).toContain("organization:manage");
    });

    it("should expand admin permissions", () => {
      const perms = getExpandedPermissions("admin");
      expect(perms).toContain("documents:view");
      expect(perms).toContain("documents:create");
      expect(perms).not.toContain("organization:billing");
    });

    it("should expand member permissions", () => {
      const perms = getExpandedPermissions("member");
      expect(perms).toContain("documents:view");
      expect(perms).toContain("documents:create");
      expect(perms).not.toContain("users:delete");
    });
  });
});
```

---

#### 8.2 Integration Tests

**File**: `convex/auth/auth.integration.test.ts` (NEW)

Test the full auth flow with permission checking.

---

#### 8.3 Update Documentation

**File**: `ROLES_AND_PERMISSIONS.md`

Update with:

- Migration guide from old system
- Permission list reference
- Code examples for common patterns
- Troubleshooting guide

---

## Migration Strategy

### Database Migration

**File**: `convex/migrations/001_add_permissions.ts` (NEW)

```typescript
import { internalMutation } from "../_generated/server";

export const addPermissionFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 1. Add status to all organizations
    const orgs = await ctx.db.query("organizations").collect();
    for (const org of orgs) {
      if (!org.status) {
        await ctx.db.patch(org._id, { status: "active" });
      }
    }

    // 2. Add isSuperAdmin flag to users
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.isSuperAdmin === undefined) {
        await ctx.db.patch(user._id, { isSuperAdmin: false });
      }
    }

    // 3. Validate member roles are valid
    const members = await ctx.db.query("organization_members").collect();
    for (const member of members) {
      const validRoles = ["owner", "admin", "member", "viewer"];
      if (!validRoles.includes(member.role)) {
        // Default to member
        await ctx.db.patch(member._id, { role: "member" });
      }
    }

    console.log("Migration complete");
  },
});
```

**Run migration**:

```bash
npx convex run migrations/001_add_permissions:addPermissionFields
```

---

### Backward Compatibility

During rollout:

1. Keep old auth functions working
2. Gradually migrate endpoints to use new wrappers
3. Monitor error logs for permission denials
4. Add feature flags for gradual rollout

---

## Testing Plan

### Unit Tests

- [ ] Permission helper functions
- [ ] Permission expansion (wildcards)
- [ ] Role template definitions

### Integration Tests

- [ ] Auth context resolution
- [ ] Permission checking in wrappers
- [ ] Custom role CRUD operations
- [ ] Role assignment

### E2E Tests

- [ ] User login and role assignment
- [ ] UI permission gates
- [ ] Role management flows
- [ ] Document access with permissions

### Manual Testing Scenarios

1. **Super Admin**
   - Login as super admin
   - Verify access to all organizations
   - Verify all permissions granted

2. **Owner**
   - Create organization
   - Invite members
   - Assign roles
   - Delete organization

3. **Admin**
   - Manage members
   - Create custom roles
   - Cannot access billing

4. **Member**
   - Create documents
   - View templates
   - Cannot delete other's documents

5. **Viewer**
   - View documents
   - Cannot create/edit/delete

6. **Custom Roles**
   - Create custom role with specific permissions
   - Assign to member
   - Verify permissions work correctly

---

## Rollout Strategy

### Stage 1: Internal Testing (1 week)

- Deploy to development environment
- Test with internal team
- Fix critical bugs

### Stage 2: Beta Testing (2 weeks)

- Deploy to staging with select users
- Monitor error logs
- Gather feedback
- Refine permissions

### Stage 3: Gradual Rollout (2 weeks)

- Enable for 10% of organizations
- Monitor metrics (permission denials, errors)
- Increase to 50%
- Full rollout

### Stage 4: Cleanup (1 week)

- Remove old auth code
- Update documentation
- Create video tutorials

---

## Success Metrics

- [ ] Zero authentication/authorization errors in production
- [ ] All endpoints protected with permission checks
- [ ] UI correctly shows/hides features based on permissions
- [ ] Custom roles can be created and assigned
- [ ] Performance: Permission resolution < 50ms
- [ ] Documentation complete with examples

---

## Risk Mitigation

### Risk: Permission Denial Blocks Users

**Mitigation**:

- Feature flag for rollback
- Super admin bypass for emergencies
- Detailed logging of permission checks
- Manual override capability

### Risk: Performance Degradation

**Mitigation**:

- Cache permission resolution results
- Index organization_members by userId + organizationId
- Monitor query performance
- Optimize permission expansion

### Risk: Breaking Changes

**Mitigation**:

- Comprehensive test coverage
- Gradual rollout
- Backward compatibility during transition
- Rollback plan

---

## Timeline Summary

| Phase                      | Duration     | Start  | End    |
| -------------------------- | ------------ | ------ | ------ |
| 0. Preparation             | 1 day        | Day 0  | Day 1  |
| 1. Core Permission System  | 3-4 days     | Day 1  | Day 5  |
| 2. Query/Mutation Wrappers | 2-3 days     | Day 5  | Day 8  |
| 3. Apply Wrappers          | 2-3 days     | Day 8  | Day 11 |
| 4. Custom Roles            | 2-3 days     | Day 11 | Day 14 |
| 5. Frontend Permissions    | 3-4 days     | Day 14 | Day 18 |
| 6. Role Management UI      | 3-4 days     | Day 18 | Day 22 |
| 7. Member Assignment UI    | 2-3 days     | Day 22 | Day 25 |
| 8. Testing & Docs          | 2-3 days     | Day 25 | Day 28 |
| **Total**                  | **~4 weeks** | -      | -      |

---

## Next Steps

1. **Review this plan** with team
2. **Create Linear tickets** for each phase
3. **Set up feature branch**: `feature/roles-permissions`
4. **Schedule kickoff meeting**
5. **Begin Phase 1** implementation

---

## Questions for Discussion

1. Do we need additional permissions beyond what catapult-vite has?
2. Should we implement permission overrides in Phase 1 or Phase 4?
3. What should be the default role for new members?
4. How should we handle role conflicts (e.g., owner leaving organization)?
5. Should we support time-based permissions (temporary access)?

---

## Appendix: Permission Reference

See `convex/auth/permissions.ts` for the complete list of permissions organized by domain:

- **organization**: View, edit, manage, billing, members, invitations
- **documents**: View, create, edit, delete, share, export
- **templates**: View, create, edit, delete, use
- **settings**: View, edit, integrations
- **users**: View, create, edit, delete, roles
- **audit**: View, export
- **system**: Super admin, maintenance

---

## Appendix: Code Patterns

### Pattern 1: Simple Permission Check

```typescript
export const myQuery = permissionQuery("documents:view")({
  args: {},
  handler: async (ctx) => {
    // Permission already checked
    return await ctx.db.query("documents").collect();
  },
});
```

### Pattern 2: Multiple Permissions (Any)

```typescript
export const myQuery = permissionAnyQuery(["documents:edit", "documents:delete"])({
  args: {},
  handler: async (ctx) => {
    // User has at least one of the permissions
    return data;
  },
});
```

### Pattern 3: Multiple Permissions (All)

```typescript
export const myMutation = permissionAllMutation(["documents:edit", "documents:share"])({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    // User has both permissions
    await ctx.db.patch(args.id, { shared: true });
  },
});
```

### Pattern 4: Admin Only

```typescript
export const dangerousMutation = adminMutation({
  args: {},
  handler: async (ctx) => {
    // Only admins and owners can execute
    await performDangerousOperation();
  },
});
```

### Pattern 5: Manual Check

```typescript
export const flexibleQuery = authQuery({
  args: { includePrivate: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const docs = await ctx.db.query("documents").collect();

    // Manual permission check
    if (args.includePrivate) {
      if (!ctx.auth.hasPermission("documents:private")) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Cannot view private documents",
        });
      }
      return docs; // Include all
    }

    return docs.filter((d) => !d.private);
  },
});
```

---

**End of Implementation Plan**
