# Seal Project - Complete Exploration Summary

## Executive Overview

The Seal project is a **document signing platform** with a sophisticated multi-tenant architecture. It uses:

- **Clerk** for authentication (user sign-in/sign-up)
- **Convex** for backend (real-time database + serverless functions)
- **React 19 + TanStack Router** for frontend
- **Role-Based Access Control (RBAC)** for authorization

The system supports **multiple organizations per user** with fine-grained permissions at the organization and document levels.

---

## Project Structure

### Backend (`/apps/backend/convex/`)

**Core Authentication**:

- `auth.ts` - Main auth context, defines `AuthContext` type with helper methods
- `auth.utils.ts` - 540 lines of permission logic, role hierarchy, and utility functions
- `auth.config.ts` - Clerk integration configuration

**Database Schemas** (`/schemas/`):

- `users.ts` - User records with Clerk ID, timezone, locale, active organization
- `organizations.ts` - Organization definitions (personal, group, company)
- `organization_members.ts` - The crucial table linking users to roles + status
- `organization_invitations.ts` - Pending invitations (7-day expiry)
- `documents.ts` - Document metadata and sharing mode
- `document_access.ts` - Explicit per-user document permissions

**Business Logic**:

- `organizations/queries.ts` - Get org, members, invitations, permissions
- `organizations/mutations.ts` - Create org, manage members, invite, change roles
- `documents/queries.ts` - Document retrieval with access control
- `documents/mutations.ts` - Upload, create, delete, update documents
- `documents/sharing.ts` - Sharing modes, grant/revoke access, transfer ownership

**Additional**:

- `check_membership.ts` - User's organization list
- `retired_provider/` - Subscription integration
- `_generated/` - Auto-generated types and API exports

### Frontend (`/apps/web/src/`)

**Routing** (`/routes/`):

- `_auth/` - Public login/signup pages
- `_authenticated/` - Protected workspace routes with organization slug parameter
- `$slug/` - Organization workspace with sidebar and sub-routes
  - `home.tsx`, `documents.tsx`, `templates.tsx`, `analytics.tsx`
  - `settings/` - team management, billing

**Components** (`/components/`):

- `app-sidebar.tsx` - Main navigation with permission-based menu items
- `team-switcher.tsx` - Switch between user's organizations
- `nav-user.tsx` - User profile dropdown
- `nav-main.tsx` - Main navigation links
- `enforce-organization.tsx` - Ensures user has organization set up
- `page-wrapper.tsx` - Page layout wrapper

**Supporting**:

- `integrations/clerk/` - Clerk provider setup
- `lib/organization-path.ts` - Route path utilities
- `hooks/use-mobile.tsx` - Mobile detection hook
- `ui/` - Shadcn UI components (buttons, dialogs, dropdowns, etc.)

**Main App Setup** (`/main.tsx`):

- ClerkProvider (Clerk auth state)
- ConvexProviderWithClerk (Bridges Clerk + Convex)
- QueryClientProvider (TanStack React Query)
- RouterProvider (TanStack Router)

---

## Authentication & Authorization System

### Authentication (Clerk)

1. User visits app
2. ClerkProvider checks if user is signed in
3. If not signed in, redirected to `/sign-in` page
4. User signs in with email/password/OAuth
5. Clerk creates user and JWT token
6. Token passed to Convex for subsequent requests

### Authorization (Convex + Database)

Each mutation/query gets user context via `getAuthContext(ctx)`:

```typescript
const auth = await getAuthContext(ctx);
// Returns:
// - member: Doc<"organization_members"> with role + status
// - user: Doc<"users">
// - organization: Doc<"organizations">
// - subscription: optional active subscription
// - Helper methods: hasPermission(), hasRole(), isOwner(), isAdmin(), etc.
```

**Status Check**: User must be `status: "active"` in organization_members

**Role Hierarchy**:

```
system (150) > owner (100) > admin (75) > member (50) > viewer (25)
```

Higher roles inherit all permissions of lower roles.

**Permission Strings**: 40+ domain-specific permissions like:

- `org:manage`, `org:settings:read`, `org:settings:update`
- `org:users:read`, `org:users:invite`, `org:users:remove`, `org:users:update_role`
- `documents:read`, `documents:create`, `documents:update`, `documents:delete`
- `subscription:manage`, `subscription:billing:read`, `subscription:billing:update`
- And many more...

### Query/Mutation Wrappers

```typescript
authQuery / authMutation; // Any active member
adminQuery / adminMutation; // Requires admin+ role
memberQuery / memberMutation; // Requires member+ role
```

---

## Database Design

### Key Tables

**users**:

- Indexed by: clerk_id, email, active_organization_id
- Fields: name, email, avatar, timezone, locale, onboarding flags

**organizations**:

- Indexed by: slug (unique), type, is_active, clerk_id
- Types: personal, group, company
- Fields: name, logo, metadata, currency, timezone

**organization_members** (THE crucial table):

- Indexed by: user_organization (compound), user, organization, primary
- Fields:
  - `role` - owner, admin, member, viewer, system
  - `status` - active, inactive, suspended, pending, blocked
  - `permissions` - optional array of individual permission overrides
  - `isPrimary` - which org is user's primary

**organization_invitations**:

- Indexed by: email, organization
- Fields: role, status, token (for link), invitedBy, expiresAt (7 days)

**documents**:

- Indexed by: organization, owner, status, sharing_mode
- Fields:
  - `sharingMode` - private, workspace, specific
  - `status` - active, archived, deleted (soft delete)
  - `storageId` - reference to Convex file storage

**document_access** (For specific sharing):

- Indexed by: document_user (compound), document, user
- Fields:
  - `permissionLevel` - view, edit, manage
  - `grantedBy`, `grantedAt`, `revokedAt` (audit trail)

### Indexes

All tables heavily indexed for fast queries:

- Single field indexes for common filters
- Compound indexes for multi-field lookups
- Critical index: `organization_members.by_user_organization` - used in auth flow

---

## Permission System Deep Dive

### Role → Permission Mapping

**Owner** gets 35+ permissions including:

- All organization management
- All subscription management
- All document operations
- Team member management
- Audit & compliance
- API & webhook management

**Admin** gets 23+ permissions including:

- View org settings
- View & invite members
- All document operations
- View billing
- View audit logs
- API & webhook management

**Member** gets 14 permissions including:

- Create/read/update documents
- Create/read/use templates
- Download documents
- View analytics
- Export personal data

**Viewer** gets 6 read-only permissions

**System** gets wildcard `*` (all permissions)

### Permission Checking Functions

In `auth.utils.ts`:

```typescript
hasPermission(member, permission); // Direct permission check
hasRole(member, requiredRole); // Role hierarchy check
getEffectivePermissions(member); // All applicable permissions
isAccountValid(member); // Check status === "active"
(isOwner(member), isAdmin(member)); // Role shortcuts
canManageDocuments(member, orgId); // Composite checks
canManageMembers(member);
canManageSubscription(member);
// ... 20+ more specific helper functions
```

### Frontend Permission Gating

Frontend fetches permissions via `getUserPermissions` query:

```typescript
const permissions = useQuery(api.organizations.queries.getUserPermissions, {
  organizationId: orgId,
});

// Returns object with boolean flags:
// permissions.canManageOrganization
// permissions.canViewMembers
// permissions.canInviteMembers
// permissions.canUpdateRoles
// permissions.canRemoveMembers
// permissions.canManageBilling
// ... 15+ more
```

Components conditionally render based on these flags.

---

## Two-Tier Access Control for Documents

### Tier 1: Organization-Level (Role-Based)

```
Member role    → Can create & edit documents
Viewer role    → Cannot create documents
```

### Tier 2: Document-Level (Sharing Modes)

```
private    → Only owner
workspace  → All org members (requires Pro subscription)
specific   → Only users with explicit document_access record (requires Pro)
```

Within specific mode, each user has permission_level:

```
view   → Read only
edit   → Can modify
manage → Can share, transfer ownership, delete
```

---

## User Journey & Role Assignment

### Signup Flow

1. User signs up with Clerk
2. Clerk webhook creates user record in Convex
3. Frontend calls `ensurePersonalOrganization()`
4. Personal organization created
5. User added as `owner` to personal org
6. User can now access workspace at `/{slug}`

### Invitation Flow

1. Owner/Admin calls `createInvitation(email, role)`
2. Invitation record created with 7-day expiry
3. Invitee gets email with invitation link
4. Invitee signs up with invited email
5. Webhook detects matching email, auto-accepts
6. User created with specified role

### Role Changes

1. Owner/Admin calls `updateMemberRole(memberId, newRole)`
2. Checks: cannot change own role, cannot assign owner unless owner
3. Member record updated with new role
4. Permissions immediately change on next action

### Status Changes

1. Owner/Admin calls `updateMemberStatus(memberId, status)`
2. On next action, `getAuthContext()` validates status
3. If not `active`, user gets error and cannot proceed

---

## Error Handling

**Custom Error Types**:

```
NO_IDENTITY, NO_USER_RECORD, NO_MEMBER_RECORD, NO_ORGANIZATION,
NO_SUBSCRIPTION, INSUFFICIENT_PERMISSIONS, INSUFFICIENT_ROLE,
ACCOUNT_INACTIVE, ACCOUNT_SUSPENDED, ACCOUNT_PENDING, ACCOUNT_BLOCKED,
WRONG_ORGANIZATION, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_REQUIRED
```

**Error Creation Helper**:

```typescript
createAuthError(type, message?, metadata?)
```

**ConvexError**:

```typescript
throw new ConvexError("User-friendly message");
```

---

## Tech Stack

**Backend**:

- Convex 1.28.0 - Serverless backend with real-time DB
- convex-helpers 0.1.104 - Custom query/mutation utilities
- Clerk (via auth.config.ts) - Authentication provider
- retired provider 19.1.0 - Subscription processing
- Zod 3.25.76 - Schema validation
- Svix 1.77.0 - Webhook handling

**Frontend**:

- React 19.2.0 - UI framework
- Vite 7.1.11 - Build tool
- TanStack React Router 1.133.21 - Routing
- TanStack React Query 5.90.5 - State management
- Convex React Client 1.28.0 - Backend integration
- Clerk React SDK 5.53.2 - Auth UI
- Shadcn UI - Component library
- Tailwind CSS 4.1.15 - Styling
- Biome 2.2.4 - Linting & formatting

---

## Key Files Map

| Task                   | Primary File                 | Secondary Files                               |
| ---------------------- | ---------------------------- | --------------------------------------------- |
| Check user permission  | `auth.utils.ts`              | `auth.ts`                                     |
| Create organization    | `organizations/mutations.ts` | `organizations.ts` schema                     |
| Manage team members    | `organizations/mutations.ts` | `organization_members.ts` schema              |
| Handle documents       | `documents/mutations.ts`     | `documents.ts` schema                         |
| Control sharing        | `documents/sharing.ts`       | `document_access.ts` schema                   |
| Fetch permissions      | `organizations/queries.ts`   | -                                             |
| Frontend workspace     | `$slug.tsx`                  | `app-sidebar.tsx`, `enforce-organization.tsx` |
| Frontend team settings | `settings/team.tsx`          | `organizations/mutations.ts`                  |
| Auth entry point       | `main.tsx`                   | `_authenticated.tsx`, `_auth.tsx`             |

---

## Critical Invariants

1. **Every user in active org has role + active status**
2. **Role hierarchy always enforced** - Cannot give member more permissions than admin
3. **Status checked on every action** - Suspended/blocked users rejected at `getAuthContext()`
4. **Organization ownership** - At least one owner must exist, cannot remove last owner
5. **Self-protection** - Cannot change own role, cannot remove self from org
6. **Owner privilege** - Only owner can assign/change owner role
7. **Plan-based features** - Team sharing requires Pro subscription check
8. **Document ownership** - Owner cannot lose all access when transferring

---

## Common Integration Points

### Adding a New Feature

1. Define permission: Add string to `DOCUMENT_SIGNING_PERMISSIONS`
2. Add to roles: Update `ROLE_PERMISSIONS` object
3. Backend check: Use `hasPermission(member, PERMISSION)` in mutation
4. Frontend gate: Query `getUserPermissions` and check boolean flag
5. UI rendering: Conditionally show/hide based on permission

### Protecting a Mutation

```typescript
// Option 1: Use wrapper
export const myFeature = adminMutation({
  handler: async (ctx, args) => { ... }  // Auto-checks admin+
});

// Option 2: Manual check
export const myFeature = authMutation({
  handler: async (ctx, args) => {
    if (!hasPermission(ctx.auth.member, "permission:string")) {
      throw new ConvexError("Insufficient permissions");
    }
    // ...
  }
});
```

### Frontend Permission Gating

```typescript
const permissions = useQuery(api.organizations.queries.getUserPermissions, ...);

if (!permissions?.permissions.canDoSomething) {
  return <LockedFeature />;
}

return <Feature />;
```

---

## Generated Documentation Files

Three comprehensive guides have been created and saved to the project:

1. **SEAL_ARCHITECTURE.md** - Complete system overview, all components, schemas
2. **ROLES_AND_PERMISSIONS.md** - Deep dive into permission system with code examples
3. **QUICK_START_ROLES.md** - 5-minute reference for common tasks

All files located in: `/Users/gbarros/Developer/plasma/seal/`
