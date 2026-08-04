# Seal Project - Comprehensive Architecture Overview

## Project Structure

```
seal/
├── apps/
│   ├── backend/          # Convex backend
│   │   └── convex/
│   │       ├── auth.ts                   # Auth context & error handling
│   │       ├── auth.utils.ts             # Permission & role checking
│   │       ├── auth.config.ts            # Clerk integration config
│   │       ├── schema.ts                 # Database schema definitions
│   │       ├── check_membership.ts       # Membership queries
│   │       ├── schemas/                  # Individual table schemas
│   │       │   ├── users.ts
│   │       │   ├── organizations.ts
│   │       │   ├── organization_members.ts
│   │       │   ├── organization_invitations.ts
│   │       │   ├── documents.ts
│   │       │   ├── document_access.ts
│   │       │   ├── subscriptions.ts
│   │       │   └── ...
│   │       ├── organizations/
│   │       │   ├── queries.ts            # Organization read operations
│   │       │   └── mutations.ts          # Organization write operations
│   │       ├── documents/
│   │       │   ├── queries.ts            # Document read operations
│   │       │   ├── mutations.ts          # Document write operations
│   │       │   └── sharing.ts            # Document sharing logic
│   │       ├── retired_provider/                   # retired provider subscription integration
│   │       └── _generated/               # Auto-generated types & API
│   │
│   └── web/              # React + Vite frontend
│       ├── src/
│       │   ├── main.tsx               # App entry point (Clerk + Convex setup)
│       │   ├── routes/                # TanStack Router routes
│       │   │   ├── _auth/             # Public auth routes (sign-in, sign-up)
│       │   │   ├── _authenticated/    # Protected routes
│       │   │   │   ├── $slug/         # Organization workspace routes
│       │   │   │   │   ├── home.tsx
│       │   │   │   │   ├── documents.tsx
│       │   │   │   │   ├── templates.tsx
│       │   │   │   │   ├── analytics.tsx
│       │   │   │   │   └── settings/
│       │   │   │   │       ├── team.tsx
│       │   │   │   │       ├── billing.tsx
│       │   │   │   │       └── ...
│       │   │   │   └── onboarding/
│       │   │   └── _authenticated.tsx  # Auth guard layout
│       │   │
│       │   ├── components/
│       │   │   ├── app-sidebar.tsx     # Main sidebar navigation
│       │   │   ├── nav-user.tsx        # User menu
│       │   │   ├── team-switcher.tsx   # Organization switcher
│       │   │   ├── enforce-organization.tsx  # Org setup enforcement
│       │   │   ├── page-wrapper.tsx    # Page layout wrapper
│       │   │   ├── documents/          # Document components
│       │   │   ├── team/               # Team management components
│       │   │   └── ui/                 # Shadcn UI components
│       │   │
│       │   ├── hooks/
│       │   │   └── use-mobile.tsx
│       │   │
│       │   ├── lib/
│       │   │   ├── organization-path.ts # Route path utilities
│       │   │   └── utils.ts
│       │   │
│       │   └── integrations/
│       │       └── clerk/
│       │           ├── provider.tsx
│       │           └── header-user.tsx
```

## Authentication & Authorization Architecture

### 1. Authentication (Clerk Integration)

**Frontend Setup** (`apps/web/src/main.tsx`):

```
ClerkProvider (Clerk auth state)
  └── ConvexProviderWithClerk (Bridges Clerk + Convex)
      └── QueryClientProvider (TanStack React Query)
          └── RouterProvider (TanStack Router with auth routes)
```

**Key Auth Files**:

- `apps/backend/convex/auth.config.ts` - Clerk Convex configuration
- `apps/web/src/routes/_auth.tsx` - Public auth layout
- `apps/web/src/routes/_authenticated.tsx` - Protected route layout with `SignedIn`/`SignedOut` guards

### 2. Authorization System

**Role-Based Access Control (RBAC)**:

- Located: `apps/backend/convex/auth.utils.ts`
- Roles: `owner` (100), `admin` (75), `member` (50), `viewer` (25), `system` (150)

**Permission Model**:
Each role has specific permissions grouped by domain:

- Organization: manage, settings (read/update), users (read/invite/remove/update_role)
- Subscriptions: manage, billing (read/update)
- Documents: read, create, update, delete, send, cancel, download
- Templates: read, create, update, delete, use
- Signatures: read, download
- API & Webhooks: read, create, delete, manage
- Audit: read, export
- Analytics & Reports: read, generate
- Data: export, backup

**Permission Checking Functions**:

```typescript
hasPermission(member, permission); // Check specific permission
hasRole(member, requiredRole); // Check role hierarchy
getEffectivePermissions(member); // Get all permissions for role
canManageDocuments(member, orgId);
canSendDocuments(member);
canManageMembers(member);
// ... and many more specific helpers
```

### 3. Auth Context Retrieval

**Function**: `getAuthContext(ctx)` in `auth.ts`

**Returns**: `AuthContext` with:

- `member` - Organization member record with role & status
- `user` - User record (Clerk ID, email, name, active org)
- `organization` - Current organization
- `subscription` - Active subscription (if any)
- `userType` - Personal/business classification
- Helper methods:
  - `hasPermission(permission: string) => boolean`
  - `hasRole(role: OrganizationMemberRole) => boolean`
  - `isOwner(), isAdmin(), isPersonalUser(), isBusinessUser()`
  - `canManageFinances(), canManageSubscription(), canManageMembers()`

**Query/Mutation Wrapper Patterns**:

```typescript
authQuery; // Basic authenticated query
adminQuery; // Requires admin+ role
memberQuery; // Requires member+ role
authMutation; // Basic authenticated mutation
adminMutation; // Requires admin+ role
memberMutation; // Requires member+ role
```

### 4. Account Status Validation

**Member Statuses**: `active`, `inactive`, `suspended`, `pending`, `blocked`

**Enforcement**: `isAccountValid(member)` checks status === "active"

**Error Handling**: Maps status to specific error types:

- `ACCOUNT_INACTIVE`, `ACCOUNT_SUSPENDED`, `ACCOUNT_PENDING`, `ACCOUNT_BLOCKED`

## Database Schema

### Core Tables

#### 1. **users**

```
- clerkId (indexed) - Clerk user ID
- name, email, avatar
- isEmailVerified, lastLoginAt
- activeOrganizationId (ref to organizations)
- timezone, locale
- onboardingCompleted tracking
- Indexes: by_clerk_id, by_email, by_active_org
```

#### 2. **organizations**

```
- name, slug (indexed, unique)
- type: personal | group | company
- logo, metadata
- currency, currencyKind, timezone
- isActive (indexed)
- clerkId (Clerk org ID, optional)
- Indexes: by_slug, by_type, by_active, by_clerk_id
```

#### 3. **organization_members**

```
- userId, organizationId (compound index)
- role: system | owner | admin | member | viewer
- status: active | inactive | suspended | pending | blocked
- permissions: optional string array for individual permissions
- isPrimary: boolean (which org is primary for user)
- externalId: optional external identifier
- Indexes: by_user, by_organization, by_user_organization, by_user_primary, by_organization_status, by_user_status
```

#### 4. **organization_invitations**

```
- organizationId, email (indexed together)
- role (what role to assign when accepted)
- status: pending | accepted | rejected | expired
- token: unique invitation token
- invitedBy: userId of inviter
- expiresAt: timestamp (7 days)
- createdAt: timestamp
```

#### 5. **documents**

```
- organizationId (indexed), ownerId
- name, description, fileSize, fileType (MIME)
- storageId: Convex Storage reference
- sharingMode: private | workspace | specific
- status: active | archived | deleted
- createdAt, updatedAt
- Indexes: by_organization, by_owner, by_status, by_sharing_mode, by_organization_status
```

#### 6. **document_access** (For specific sharing)

```
- documentId, userId (compound index)
- permissionLevel: view | edit | manage
- grantedBy: userId of grantor
- grantedAt: timestamp
- revokedAt: optional revocation timestamp
- Indexes: by_document, by_user, by_document_user
```

### Subscription Tables

- `subscriptions` - User subscription state
- `subscription_products` - Product definitions
- `subscription_prices` - Pricing tiers

## API Structure & Patterns

### Query Organization (Reads)

**Location**: `apps/backend/convex/organizations/queries.ts`

Key queries:

- `getOrganization(slug)` - Get org details with user's role/status
- `getOrganizationMembers(orgId)` - List all members with details
- `getPendingInvitations(orgId)` - Invitations (requires invite permission)
- `getUserPermissions(orgId)` - Detailed permission object
- `getOrganizationMemberCount(orgId)` - Member counts by role/status

### Mutation Organization (Writes)

**Location**: `apps/backend/convex/organizations/mutations.ts`

Key mutations:

- `ensurePersonalOrganization()` - Create personal org for user
- `createWorkspace()` - Admin: Create new organization
- `updateWorkspace()` - Admin: Update org settings
- `deleteWorkspace()` - Owner: Delete organization (cascade delete members/invitations)
- `addMember()` - Admin: Add member to org
- `updateMemberRole()` - Admin: Change member role (prevent self-change, owner-only rules)
- `removeMember()` - Admin: Remove member (prevent self-remove, last-owner protection)
- `createInvitation()` - Admin: Send invitation (7-day expiry)
- `updateMemberStatus()` - Admin: Change member status (prevent self-change)

### Document Queries

**Location**: `apps/backend/convex/documents/queries.ts`

- `getDocument(docId)` - Get document with access control
  - Owner always has access
  - Workspace sharing = all org members can access
  - Specific sharing = only explicit access records
- `getDocumentUrl(docId)` - Get download URL (same access rules)
- `listDocuments(orgId, filter)` - List accessible documents
  - Filters: all, owned, shared
  - Access filtered per document
- `getDocumentAccessList(docId)` - Get access records (owner/managers only)

### Document Mutations

**Location**: `apps/backend/convex/documents/mutations.ts`

- `generateUploadUrl()` - Create upload URL for client
- `createDocument(orgId, name, ...)` - Create doc after upload
- `deleteDocument(docId)` - Soft delete (mark as deleted)
- `updateDocument(docId, name, description)` - Update metadata

### Document Sharing

**Location**: `apps/backend/convex/documents/sharing.ts`

- `updateSharingMode(docId, mode)` - Change sharing (owner/managers)
  - Workspace & specific modes require Pro plan
- `grantAccess(docId, userId, level)` - Grant specific user access
  - User must be org member
  - Document must be in "specific" mode
- `revokeAccess(docId, userId)` - Revoke access (soft delete)
- `updateAccessLevel(docId, userId, level)` - Change permission level
- `transferOwnership(docId, newOwnerId)` - Transfer ownership
  - Gives previous owner "manage" permission

## Frontend Architecture

### Routing Structure

**Route Hierarchy**:

```
/ (index)
├── /sign-in (public)
├── /sign-up (public)
├── /_authenticated (protected)
│   ├── /onboarding/choose-organization
│   └── /$slug (workspace)
│       ├── / (index - home)
│       ├── /documents
│       ├── /templates
│       ├── /analytics
│       ├── /settings
│       │   ├── / (index)
│       │   ├── /team
│       │   └── /billing
│       └── ... (more routes)
```

**Auth Guards**:

- `_authenticated.tsx` - Uses Clerk's `SignedOut` to redirect to `/sign-in`
- `_authenticated` layout wraps `EnforceOrganization` component
- `EnforceOrganization` ensures user has org before accessing workspace

### Component Organization

**Key Components**:

- `AppSidebar` - Main navigation sidebar with menu items
- `TeamSwitcher` - Switch between user's organizations
- `NavMain` - Main navigation links (home, documents, templates, etc.)
- `NavUser` - User profile menu (settings, sign out)
- `PageWrapper` - Page layout wrapper
- `EnforceOrganization` - Org setup enforcement/creation

**Permissions-Based UI**:
Frontend uses `permissions` object from `getUserPermissions` query to conditionally show UI:

- `canManageOrganization`, `canViewMembers`, `canInviteMembers`, etc.

### Permission Fetching

In workspace layout (`$slug.tsx`):

```typescript
const organization = useQuery(api.organizations.queries.getOrganization, {
  slug,
});
const permissions = useQuery(api.organizations.queries.getUserPermissions, {
  organizationId: orgId,
});
```

Passes `permissions` to sidebar for UI rendering.

## Key Features & Their Permission Integration

### 1. Document Management

- **View**: Any accessible document (by sharing mode)
- **Create**: `documents:create` permission
- **Edit**: Owner or `edit`/`manage` access level
- **Delete**: Owner only
- **Download**: `documents:download` permission
- **Share**: Owner or `manage` access level

### 2. Team Management

- **View Members**: `org:users:read`
- **Invite Members**: `org:users:invite`
- **Remove Members**: `org:users:remove`
- **Update Roles**: `org:users:update_role` (admin/owner only)
- **Update Status**: Admin only

### 3. Organization Settings

- **View Settings**: `org:settings:read`
- **Update Settings**: `org:settings:update` (admin only)
- **Manage Organization**: `org:manage` (admin only)

### 4. Subscription/Billing

- **View Billing**: `subscription:billing:read`
- **Manage Billing**: `subscription:manage` (admin only)
- **Feature Gating**: Team sharing requires Pro subscription

### 5. Audit & Compliance

- **View Audit Logs**: `audit:read`
- **Export Audit**: `audit:export`

## Error Handling

**Custom Error Types** (`AuthErrorType`):

```
NO_IDENTITY, NO_USER_RECORD, NO_MEMBER_RECORD, NO_ORGANIZATION,
NO_SUBSCRIPTION, INSUFFICIENT_PERMISSIONS, INSUFFICIENT_ROLE,
ACCOUNT_INACTIVE, ACCOUNT_SUSPENDED, ACCOUNT_PENDING, ACCOUNT_BLOCKED,
WRONG_ORGANIZATION, SUBSCRIPTION_EXPIRED, SUBSCRIPTION_REQUIRED
```

**Error Creation**: `createAuthError(type, message?, metadata?)`

**Frontend Error Handling**:

- Throws `ConvexError` with descriptive messages
- Special hint: `CALL_ENSURE_MEMBERSHIP` for missing org setup

## Integration Points for Roles & Permissions

### Where to Add New Permissions:

1. **Define permission string**: `auth.utils.ts` - `DOCUMENT_SIGNING_PERMISSIONS` constant
2. **Add to role**: Update `ROLE_PERMISSIONS[role]` array
3. **Create check function**: Optional helper like `canManageFeature(member)`
4. **Backend enforcement**: Use `hasPermission(member, PERMISSION)` in mutations
5. **Frontend gating**: Conditionally render UI based on permissions object

### Where Roles Are Assigned:

1. **Personal Org Creation**: `ensurePersonalOrganization()` - User gets `owner` role
2. **Workspace Creation**: `createWorkspace()` - Creator gets `owner` role
3. **Member Addition**: `addMember()` - Specify role (admin, member, viewer)
4. **Invitation Acceptance**: Implicit when user signs up with invited email
5. **Role Updates**: `updateMemberRole()` - Can change existing member's role

### Permission Checks Occur At:

- **All authenticated queries**: `getAuthContext()` validates user is active member
- **Mutation handlers**: Check specific permissions before operations
- **Organization queries**: Verify user is org member
- **Document operations**: Owner/access level checks
- **Admin operations**: Role hierarchy checks

## Tech Stack Summary

**Backend**:

- Convex (serverless backend, real-time database)
- Clerk (authentication)
- retired provider (subscriptions)
- Zod (validation)
- convex-helpers (utilities)

**Frontend**:

- React 19
- Vite (build tool)
- TanStack Router (routing)
- TanStack React Query (state management)
- Convex React Client (backend integration)
- Clerk React SDK
- Shadcn UI (component library)
- Tailwind CSS
- Biome (formatting/linting)

## Generated Files

Auto-generated files in `_generated` folder (committed to git per CLAUDE.md instructions):

- `dataModel.ts` - Type definitions for all tables
- `api.ts` - All server function exports
- Various type definitions
