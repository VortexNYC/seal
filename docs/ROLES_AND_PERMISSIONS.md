# Seal Project - Roles & Permissions Integration Guide

## Quick Reference

### Current Role Hierarchy (in `auth.utils.ts`)

```
system: 150  // System-level access (highest)
owner: 100   // Organization owner
admin: 75    // Organization administrator
member: 50   // Regular member
viewer: 25   // Read-only access (lowest)
```

### Key Files

**Backend (Convex)**:

- `/apps/backend/convex/auth.ts` - Authentication context, query/mutation wrappers
- `/apps/backend/convex/auth.utils.ts` - Permission logic, role hierarchy, helper functions
- `/apps/backend/convex/organizations/queries.ts` - Organization data queries
- `/apps/backend/convex/organizations/mutations.ts` - Team management operations
- `/apps/backend/convex/documents/queries.ts` - Document access control
- `/apps/backend/convex/documents/sharing.ts` - Document permission management
- `/apps/backend/convex/schemas/organization_members.ts` - Member schema with role field

**Frontend (React)**:

- `/apps/web/src/routes/_authenticated/$slug.tsx` - Workspace layout with permission fetching
- `/apps/web/src/routes/_authenticated/$slug/settings/team.tsx` - Team management UI
- `/apps/web/src/components/app-sidebar.tsx` - Sidebar with permission-based menu items
- `/apps/web/src/components/nav-user.tsx` - User menu

---

## Database Schema for Roles & Permissions

### organization_members Table

```typescript
// Schema definition
export const organizationMembersTable = defineTable({
  userId: v.id("users"),
  organizationId: v.id("organizations"),

  role: organizationMemberRoleTuple, // owner | admin | member | viewer | system
  status: organizationMemberStatus, // active | inactive | suspended | pending | blocked
  permissions: v.optional(v.array(v.string())), // Individual permission overrides

  isPrimary: v.boolean(),
  externalId: v.optional(v.string()),
});
```

**Key Index**: `by_user_organization` - Enables fast lookups of member record

---

## Permission System Architecture

### 1. Permission Definitions (`auth.utils.ts`)

```typescript
// All permissions by domain
export const DOCUMENT_SIGNING_PERMISSIONS = {
  // Organization
  ORG_MANAGE: "org:manage",
  ORG_SETTINGS_READ: "org:settings:read",
  ORG_SETTINGS_UPDATE: "org:settings:update",
  ORG_USERS_READ: "org:users:read",
  ORG_USERS_INVITE: "org:users:invite",
  ORG_USERS_REMOVE: "org:users:remove",
  ORG_USERS_UPDATE_ROLE: "org:users:update_role",

  // Documents
  DOCUMENTS_READ: "documents:read",
  DOCUMENTS_CREATE: "documents:create",
  DOCUMENTS_UPDATE: "documents:update",
  DOCUMENTS_DELETE: "documents:delete",
  DOCUMENTS_SEND: "documents:send",
  DOCUMENTS_CANCEL: "documents:cancel",
  DOCUMENTS_DOWNLOAD: "documents:download",

  // ... more permissions for templates, subscriptions, etc.
} as const;
```

### 2. Role Permissions Mapping (`auth.utils.ts`)

```typescript
export const ROLE_PERMISSIONS: Record<OrganizationMemberRole, string[]> = {
  owner: [
    "org:manage",
    "org:settings:read",
    "org:settings:update",
    "org:users:read",
    "org:users:invite",
    "org:users:remove",
    "org:users:update_role",
    "subscription:manage",
    "subscription:billing:read",
    "subscription:billing:update",
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:delete",
    "documents:send",
    "documents:cancel",
    "documents:download",
    "templates:read",
    "templates:create",
    "templates:update",
    "templates:delete",
    "templates:use",
    "signatures:read",
    "signatures:download",
    "audit:read",
    "audit:export",
    "api:read",
    "api:create",
    "api:delete",
    "webhooks:read",
    "webhooks:create",
    "webhooks:update",
    "webhooks:delete",
    "analytics:read",
    "reports:read",
    "reports:generate",
    "data:export",
    "data:backup",
  ],

  admin: [
    "org:settings:read",
    "org:users:read",
    "org:users:invite",
    "subscription:billing:read",
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:delete",
    "documents:send",
    "documents:cancel",
    "documents:download",
    // ... (subset of owner permissions)
  ],

  member: [
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:send",
    "documents:cancel",
    "documents:download",
    "templates:read",
    "templates:create",
    "templates:use",
    "signatures:read",
    "signatures:download",
    "analytics:read",
    "reports:read",
    "data:export",
  ],

  viewer: [
    "documents:read",
    "documents:download",
    "templates:read",
    "signatures:read",
    "analytics:read",
    "reports:read",
  ],

  system: ["*"], // Wildcard - all permissions
};
```

---

## How Permissions Are Checked

### Backend (Server-Side Enforcement)

#### 1. Getting User Context

All mutations/queries use `getAuthContext(ctx)` which returns:

```typescript
export type AuthContext = {
  member: Doc<"organization_members">; // Contains role + status
  user: Doc<"users">;
  organization: Doc<"organizations">;
  subscription?: Doc<"subscriptions">;

  // Helper methods
  hasPermission: (permission: string) => boolean;
  hasRole: (role: OrganizationMemberRole) => boolean;
  canAccessOrganization: (orgId: Id<"organizations">) => boolean;
  isOwner: () => boolean;
  isAdmin: () => boolean;
  canManageMembers: () => boolean;
  canManageSubscription: () => boolean;
  // ... more helpers
};
```

#### 2. Permission Check in Mutations

Example from `organizations/mutations.ts` - Creating an invitation:

```typescript
export const createInvitation = adminMutation({
  args: { email: v.string(), role: v.union(...) },
  handler: async (ctx, args) => {
    // adminMutation automatically:
    // 1. Calls getAuthContext(ctx)
    // 2. Checks auth.hasRole("admin") - throws if not admin+

    const { organization, user: currentUser } = ctx.auth;

    // Explicit permission check if needed
    if (!hasPermission(ctx.auth.member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_INVITE)) {
      throw new ConvexError("Insufficient permissions to invite members");
    }

    // Rest of mutation logic...
  }
});
```

#### 3. Query/Mutation Wrapper Patterns

```typescript
// Basic authenticated (any active member)
export const authQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);
    return { auth };
  }),
);

// Admin+ required
export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);
    if (!auth.hasRole("admin")) {
      throw new ConvexError("Insufficient role");
    }
    return { auth, db: ctx.db, runQuery: ctx.runQuery };
  }),
);

// Member+ required
export const memberQuery = customQuery(
  query,
  customCtx(async (ctx) => {
    const auth = await getAuthContext(ctx);
    if (!auth.hasRole("member")) {
      throw new ConvexError("Insufficient role");
    }
    return { auth, db: ctx.db, runQuery: ctx.runQuery };
  }),
);
```

### Frontend (UI Permission Gating)

#### 1. Fetching Permissions

In workspace layout (`_authenticated/$slug.tsx`):

```typescript
function WorkspaceLayout() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  const permissions = useQuery(
    api.organizations.queries.getUserPermissions,
    orgId ? { organizationId: orgId } : "skip",
  );

  // Returns object with:
  // {
  //   role: "admin" | "owner" | "member" | "viewer",
  //   status: "active" | "inactive" | "suspended",
  //   permissions: {
  //     canManageOrganization: boolean,
  //     canViewSettings: boolean,
  //     canUpdateSettings: boolean,
  //     canViewMembers: boolean,
  //     canInviteMembers: boolean,
  //     canRemoveMembers: boolean,
  //     canUpdateRoles: boolean,
  //     canManageBilling: boolean,
  //     canCreateDocuments: boolean,
  //     // ... more permissions
  //   }
  // }
}
```

#### 2. Conditional UI Rendering

Example from `settings/team.tsx` or `app-sidebar.tsx`:

```typescript
function TeamSettingsPage() {
  const permissions = useQuery(...);

  if (!permissions?.permissions.canViewMembers) {
    return <Unauthorized />;
  }

  return (
    <div>
      {permissions.permissions.canInviteMembers && (
        <button onClick={handleInvite}>Invite Member</button>
      )}

      {permissions.permissions.canUpdateRoles && (
        <RoleSelector member={member} />
      )}

      {permissions.permissions.canRemoveMembers && (
        <button onClick={handleRemove}>Remove</button>
      )}
    </div>
  );
}
```

---

## Common Permission Checks in Code

### Mutation Examples

#### Team Management - Adding Member

```typescript
export const addMember = adminMutation({
  // adminMutation ensures user is admin+ in active state
  handler: async (ctx, args) => {
    const { organization } = ctx.auth;
    // Mutation logic...
  },
});
```

#### Team Management - Inviting User

```typescript
export const createInvitation = adminMutation({
  handler: async (ctx, args) => {
    // Optional explicit permission check
    if (!hasPermission(ctx.auth.member, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_INVITE)) {
      throw new ConvexError("Cannot invite members");
    }
    // ...
  },
});
```

#### Document Sharing - Grant Access

```typescript
export const grantAccess = authMutation({
  handler: async (ctx, args) => {
    const currentUserId = ctx.auth.user._id;
    const document = await ctx.db.get(args.documentId);

    // Check if user can manage document
    let canManage = document.ownerId === currentUserId;
    if (!canManage) {
      const access = await ctx.db
        .query("document_access")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", document._id).eq("userId", currentUserId),
        )
        .first();
      canManage = access?.permissionLevel === "manage" && !access.revokedAt;
    }

    if (!canManage) {
      throw new ConvexError("Only owner or managers can grant access");
    }
    // ...
  },
});
```

---

## How to Add a New Permission

### Step 1: Define the Permission String

In `auth.utils.ts`, add to `DOCUMENT_SIGNING_PERMISSIONS`:

```typescript
export const DOCUMENT_SIGNING_PERMISSIONS = {
  // ... existing
  MY_NEW_FEATURE: "feature:new_action",
} as const;
```

### Step 2: Add to Appropriate Roles

In `ROLE_PERMISSIONS`, add to roles that should have it:

```typescript
export const ROLE_PERMISSIONS: Record<OrganizationMemberRole, string[]> = {
  owner: [
    // ... existing
    "feature:new_action", // Add here
  ],
  admin: [
    // ... existing
    "feature:new_action", // Add here if admin should have it
  ],
  member: [
    // ... existing
    // Don't add if members shouldn't have it
  ],
  // ...
};
```

### Step 3: Create Helper Function (Optional)

```typescript
export function canDoNewFeature(member: Doc<"organization_members">): boolean {
  return hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.MY_NEW_FEATURE);
}
```

### Step 4: Backend Enforcement

In your mutation:

```typescript
export const performNewFeature = authMutation({
  handler: async (ctx, args) => {
    if (!hasPermission(ctx.auth.member, DOCUMENT_SIGNING_PERMISSIONS.MY_NEW_FEATURE)) {
      throw new ConvexError("Insufficient permissions for this feature");
    }
    // Feature logic...
  },
});
```

### Step 5: Frontend UI Gating

In your component:

```typescript
function FeatureComponent() {
  const permissions = useQuery(api.organizations.queries.getUserPermissions, ...);

  if (!permissions?.permissions.canDoNewFeature) {
    return <FeatureLockedMessage />;
  }

  return <FeatureUI />;
}
```

---

## Role Assignment Flow

### When User Creates Personal Workspace

Flow: User signs up → Clerk webhook creates user → Frontend calls `ensurePersonalOrganization`

```typescript
export const ensurePersonalOrganization = mutation({
  handler: async (ctx, args) => {
    // ... create org ...

    // Creator automatically gets OWNER role
    await ctx.db.insert("organization_members", {
      organizationId: organization._id,
      userId: user._id,
      role: "owner", // <-- Assigned here
      status: "active",
      isPrimary: true,
      permissions: [],
    });
  },
});
```

### When Admin Invites User

Flow: Admin sends invitation → User signs up with invited email → Auto-accept invitation

```typescript
export const createInvitation = adminMutation({
  handler: async (ctx, args) => {
    // ... create invitation record ...

    await ctx.db.insert("organization_invitations", {
      email: args.email,
      role: args.role, // <-- Role specified by inviter
      status: "pending",
      // ...
    });
    // Later: When user signs up, webhook accepts invitation and creates member
  },
});
```

### When Admin Changes Member Role

```typescript
export const updateMemberRole = adminMutation({
  handler: async (ctx, args) => {
    const { organization, user: currentUser } = ctx.auth;

    const membership = await ctx.db.get(args.memberId);

    // Only owner can change owner role
    if (args.role === "owner" && currentMembership?.role !== "owner") {
      throw new ConvexError("Only owners can assign owner role");
    }

    // Update role
    await ctx.db.patch(args.memberId, {
      role: args.role, // <-- Role changed here
    });
  },
});
```

---

## Permission-Based Features Matrix

| Feature            | Owner | Admin | Member | Viewer |
| ------------------ | ----- | ----- | ------ | ------ |
| Create Documents   | ✓     | ✓     | ✓      | ✗      |
| Edit Documents     | ✓     | ✓     | ✓\*    | ✗      |
| Delete Documents   | ✓     | ✓     | ✗      | ✗      |
| Share Documents    | ✓     | ✓     | ✗      | ✗      |
| Download Documents | ✓     | ✓     | ✓      | ✓      |
| View Members       | ✓     | ✓     | ✗      | ✗      |
| Invite Members     | ✓     | ✓     | ✗      | ✗      |
| Change Roles       | ✓     | ✗     | ✗      | ✗      |
| Remove Members     | ✓     | ✗     | ✗      | ✗      |
| Manage Settings    | ✓     | ✗     | ✗      | ✗      |
| View Billing       | ✓     | ✓     | ✗      | ✗      |
| Manage Billing     | ✓     | ✗     | ✗      | ✗      |

\*Members can only edit documents they own or have explicit "edit" access to

---

## Status vs Role

**Role** determines WHAT a user can do (permissions).  
**Status** determines IF they can use their permissions.

Statuses: `active`, `inactive`, `suspended`, `pending`, `blocked`

```typescript
// In auth.ts - getAuthContext()
if (!AuthUtils.isAccountValid(member)) {
  // status !== "active"
  const errorType = getStatusErrorType(member.status);
  throw new ConvexError(createAuthError(errorType).message);
}
```

Only users with `status: "active"` can perform any actions, regardless of role.

---

## Document Access Control

Documents have TWO levels of access control:

### 1. Sharing Mode (At document level)

- `private` - Only owner
- `workspace` - All org members
- `specific` - Only explicit access grants (requires Pro plan)

### 2. Permission Level (For specific mode only)

- `view` - Read only
- `edit` - Can modify
- `manage` - Can share, transfer, delete

```typescript
// In documents/queries.ts - getDocument()
let hasAccess = document.ownerId === userId;

if (!hasAccess) {
  if (document.sharingMode === "workspace") {
    hasAccess = true; // All members get access
  } else if (document.sharingMode === "specific") {
    const access = await ctx.db
      .query("document_access")
      .withIndex("by_document_user", (q) => q.eq("documentId", document._id).eq("userId", userId))
      .first();
    hasAccess = access !== null && !access.revokedAt; // Check explicit grant
  }
}
```

---

## Key Invariants

1. **Every active user has at least one organization membership** with a role and status
2. **At least one owner must exist** in each organization - cannot remove last owner
3. **Only owners can assign owner role** - prevents privilege escalation
4. **Status active is required** - Suspended/inactive users cannot perform actions
5. **Role hierarchy is enforced** - Member permissions subset of Admin subset of Owner
6. **Team sharing requires Pro plan** - Checked in `updateSharingMode()`
7. **Document owner cannot lose all access** - Explicit access created when transferring ownership
