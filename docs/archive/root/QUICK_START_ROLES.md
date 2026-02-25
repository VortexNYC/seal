# Seal Project - Roles & Permissions Quick Start

## The 5-Minute Overview

### What is the auth system?

**Clerk** handles authentication (sign-in/sign-up).  
**Convex** handles authorization (who can do what).  
**Database** stores roles and permissions for each user in each organization.

### The Role Hierarchy

```
┌─────────────────────────────────────────────┐
│ Owner (100)    - Full organization control  │
│   ├─ Can manage: members, billing, settings│
│   ├─ Can create/delete: docs, templates    │
│   └─ Only owner can change owner roles     │
├─────────────────────────────────────────────┤
│ Admin (75)     - Team management           │
│   ├─ Can view members and invite           │
│   ├─ Can create/delete documents           │
│   └─ Cannot manage billing or change roles │
├─────────────────────────────────────────────┤
│ Member (50)    - Document work             │
│   ├─ Can create and edit own documents     │
│   ├─ Can view documents shared with them   │
│   └─ Cannot manage team or settings        │
├─────────────────────────────────────────────┤
│ Viewer (25)    - Read-only access          │
│   ├─ Can only view documents               │
│   ├─ Can download documents                │
│   └─ Cannot create or edit anything        │
└─────────────────────────────────────────────┘
```

### Key Database Tables

**organization_members** - The table that connects users to roles:

```
userid: "user_123"
organizationId: "org_456"
role: "admin"              ← This is the key field
status: "active"           ← Must be "active" to perform actions
permissions: []            ← Individual overrides (optional)
```

### Permission Example

When a user tries to invite someone:

1. **Backend checks**: Does this user have `org:users:invite` permission?
2. **Permission comes from**: Their role (admin/owner) in `ROLE_PERMISSIONS`
3. **If they don't have it**: ConvexError thrown ("Insufficient permissions")
4. **If they do**: Invitation gets created

## Where Permissions Live

| What                       | Where          | File                                   |
| -------------------------- | -------------- | -------------------------------------- |
| Role definitions           | Database       | `schemas/organization_members.ts`      |
| Permission strings         | Code constants | `auth.utils.ts` line 19-286            |
| Role → Permissions mapping | Code constants | `auth.utils.ts` line 8-148             |
| Permission checks          | Mutations      | `organizations/mutations.ts`           |
| Permission fetching        | Frontend       | `$slug/tsx` queries                    |
| UI conditional rendering   | Components     | `app-sidebar.tsx`, `settings/team.tsx` |

## Common Tasks

### I need to add a new permission

1. Add string to `DOCUMENT_SIGNING_PERMISSIONS` in `auth.utils.ts`
2. Add permission to appropriate roles in `ROLE_PERMISSIONS`
3. Use `hasPermission(member, PERMISSION)` in your mutation
4. Show/hide UI based on fetched permissions object on frontend

### I need to check if a user can do something

**Backend (inside a mutation)**:

```typescript
if (!hasPermission(ctx.auth.member, "documents:create")) {
  throw new ConvexError("You cannot create documents");
}
```

**Frontend (in a React component)**:

```typescript
const permissions = useQuery(api.organizations.queries.getUserPermissions, ...);
if (!permissions?.permissions.canCreateDocuments) {
  return <div>Feature not available</div>;
}
```

### I need to restrict a feature to admins

Use the `adminMutation` wrapper instead of `authMutation`:

```typescript
export const featureForAdminsOnly = adminMutation({
  // Automatically checks user is admin+ and active
  handler: async (ctx, args) => {
    // ... your code here ...
  },
});
```

### I need to change someone's role

Call `updateMemberRole` mutation:

```typescript
await mutation(api.organizations.mutations.updateMemberRole, {
  memberId: member_id,
  role: "admin", // owner | admin | member | viewer
});
```

Constraints:

- You must be an admin
- You cannot change your own role
- Only owners can assign/change owner role

## The Auth Flow

### User signs up:

1. Clerk handles sign-in UI and creates user
2. Clerk webhook triggers → Convex creates user record in DB
3. Frontend calls `ensurePersonalOrganization` mutation
4. Personal organization created + user marked as `owner`
5. User can now use the app

### User invites someone:

1. Admin calls `createInvitation` mutation with email + role
2. Invitation record created (expires in 7 days)
3. Invitee signs up with that email
4. Webhook auto-accepts invitation
5. User created as member with specified role

### User's status changes:

1. Admin calls `updateMemberStatus` mutation
2. Status changes: active → suspended (or other status)
3. On next action, `getAuthContext()` checks status
4. If not `active`, user gets error and cannot proceed

## Permission Constants

All permission strings defined in `DOCUMENT_SIGNING_PERMISSIONS`:

```typescript
// Organization
org:manage, org:settings:read, org:settings:update
org:users:read, org:users:invite, org:users:remove, org:users:update_role

// Documents
documents:read, documents:create, documents:update, documents:delete
documents:send, documents:cancel, documents:download

// Templates
templates:read, templates:create, templates:update, templates:delete, templates:use

// Subscriptions
subscription:manage, subscription:billing:read, subscription:billing:update

// Signatures
signatures:read, signatures:download

// API & Webhooks
api:read, api:create, api:delete
webhooks:read, webhooks:create, webhooks:update, webhooks:delete

// Audit
audit:read, audit:export

// Analytics & Reports
analytics:read, reports:read, reports:generate

// Data
data:export, data:backup
```

## Error Handling

When permission check fails:

```typescript
throw new ConvexError("Insufficient permissions");
// or
throw new ConvexError("Only organization owners can do this");
// or use the helper
throw createAuthError("INSUFFICIENT_ROLE", "...", { metadata });
```

Frontend shows error message to user.

## Two-Level Document Access

Documents have organization-wide + document-level permissions:

**Org-level** (role-based):

- Member role can create docs
- Viewer role cannot

**Document-level** (sharing mode):

- `private` - Only owner
- `workspace` - All org members
- `specific` - Explicit per-user permissions (requires Pro)

## Common Mistakes to Avoid

1. ❌ Checking permission only on frontend (client can be spoofed)
   - ✓ Always check on backend in mutations

2. ❌ Forgetting to check user status (might be suspended)
   - ✓ `getAuthContext()` does this automatically

3. ❌ Not handling the case where user has no organization
   - ✓ Frontend should call `ensurePersonalOrganization()`

4. ❌ Allowing member to change own role
   - ✓ Mutation checks `userId !== currentUserId`

5. ❌ Allowing removal of last organization owner
   - ✓ Mutation checks owner count before removing

## Files to Know

**Core Auth**:

- `auth.ts` - AuthContext definition, query/mutation wrappers
- `auth.utils.ts` - Permission functions, role hierarchy
- `auth.config.ts` - Clerk Convex bridge

**Organization Management**:

- `organizations/queries.ts` - Get org details, members, permissions
- `organizations/mutations.ts` - Create org, invite, change roles

**Document Access**:

- `documents/queries.ts` - Get documents with access control
- `documents/sharing.ts` - Manage document sharing & access

**Frontend**:

- `$slug.tsx` - Fetches permissions on workspace load
- `app-sidebar.tsx` - Shows/hides menu items based on permissions
- `settings/team.tsx` - Team management UI with permission checks

## Testing Permissions

Try these in your app:

1. **Create two users** - one owner, one member
2. **Owner invites member** - works because owner has invite permission
3. **Member tries to invite** - fails because member doesn't have permission
4. **Owner makes member an admin** - now member can invite
5. **Owner removes self from org** - fails because they're the last owner
6. **Owner suspends member** - member can no longer perform actions
