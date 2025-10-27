# Seal Invitation System - Complete File Reference

## Quick File Lookup Guide

### FRONTEND FILES

#### Team Settings & Management
- **`/apps/web/src/routes/_authenticated/$slug/settings/team/index.tsx`** ⭐
  - Main team management page
  - Displays both members and invitations in tabbed interface
  - Queries: getOrganization, getUserPermissions, getOrganizationMembers, getPendingInvitations
  - Contains: InviteMemberDialog, MembersList, PendingInvitationsList

- **`/apps/web/src/routes/_authenticated/$slug/settings/team.tsx`**
  - Layout wrapper for team routes
  - Simple `<Outlet />` for nested routes

- **`/apps/web/src/routes/_authenticated/$slug/settings/team/$memberId.tsx`**
  - Individual member detail page (route exists but not fully implemented in exploration)

#### Components - Team Management
- **`/apps/web/src/components/team/invite-member-dialog.tsx`** ⭐
  - Dialog for inviting new team members
  - Features: email validation, role selection, error handling
  - Mutation: `api.organizations.mutations.createInvitation`
  - Size: ~200 lines

- **`/apps/web/src/components/team/pending-invitations-list.tsx`** ⭐
  - Table displaying pending invitations
  - Features: expiration tracking, time-ago formatting, cancellation
  - Mutation: `api.organizations.mutations.cancelInvitation`
  - Size: ~170 lines

- **`/apps/web/src/components/team/members-list.tsx`** ⭐
  - Table displaying active organization members
  - Features: search, role selector, status badges
  - Integrates: ManageMemberDialog
  - Size: ~215 lines

- **`/apps/web/src/components/team/manage-member-dialog.tsx`** ⭐
  - Dialog for managing active member role and status
  - Features: role/status selection, suspend/reactivate/remove actions
  - Mutations: updateMemberRole, updateMemberStatus, suspendMember, reactivateMember, removeMember
  - Size: ~375 lines

- **`/apps/web/src/components/team/role-selector.tsx`**
  - Inline role selector for members (referenced but not reviewed)

- **`/apps/web/src/components/team/remove-member-dialog.tsx`**
  - Remove member confirmation (referenced but not reviewed)

### BACKEND FILES

#### Database Schemas
- **`/apps/backend/convex/schemas/organization_invitations.ts`** ⭐
  - Schema for invitation records
  - Fields: organizationId, email, role, status, token, invitedBy, acceptedBy, acceptedAt, expiresAt, createdAt
  - Indexes: by_organization, by_email, by_token
  - Size: ~35 lines

- **`/apps/backend/convex/schemas/organization_members.ts`**
  - Schema for organization members (referenced for context)

- **`/apps/backend/convex/schemas/organizations.ts`**
  - Schema for organizations (referenced for context)

- **`/apps/backend/convex/schemas/users.ts`**
  - Schema for users (referenced for context)

#### Main Business Logic
- **`/apps/backend/convex/organizations/mutations.ts`** ⭐ (MOST IMPORTANT)
  - Contains ALL invitation-related mutations:
    - `createInvitation(email, role)` - Create invitation or add existing user directly
    - `cancelInvitation(invitationId)` - Cancel pending invitation
    - `addMember(userId, role)` - Add member directly
    - `updateMemberRole(memberId, role)` - Update member role
    - `updateMemberStatus(memberId, status)` - Update member status
    - `removeMember(memberId)` - Remove member from organization
    - `suspendMember(memberId)` - Suspend member
    - `reactivateMember(memberId)` - Reactivate member
    - `bulkActivateMembers(memberUpdates)` - Bulk activate members
  - Size: ~840 lines

- **`/apps/backend/convex/organizations/queries.ts`** ⭐ (MOST IMPORTANT)
  - Contains ALL invitation-related queries:
    - `getPendingInvitations(organizationId)` - Get pending invitations
    - `getOrganizationMembers(organizationId)` - Get all members
    - `getOrganization(slug)` - Get organization by slug
    - `getUserPermissions(organizationId)` - Get user's permissions
    - `getOrganizationMemberCount(organizationId)` - Get member count statistics
    - `getOrganizationMember(organizationId, memberId)` - Get specific member
  - Size: ~415 lines

#### Authentication & Authorization
- **`/apps/backend/convex/auth.ts`**
  - Defines auth wrappers: `authQuery`, `authMutation`, `adminMutation`, `ownerMutation`
  - Referenced for permission context

- **`/apps/backend/convex/auth.utils.ts`**
  - Defines permission constants and hierarchy
  - Key permission: `ORG_USERS_INVITE` (admin/owner only)
  - Referenced for permission logic

- **`/apps/backend/convex/auth/auth.permissions.ts`**
  - Enhanced authentication context with permissions
  - Resolves permissions from multiple sources

- **`/apps/backend/convex/auth/permissions.ts`**
  - Core permission resolution logic
  - Referenced for permission checking

#### Webhooks & External Integration
- **`/apps/backend/convex/webhooks.ts`** (Clerk integration)
  - Contains membership sync functions from Clerk webhooks
  - Separate from invitation system (invitations are custom)
  - Functions: syncOrganizationMembership, upsertMembershipFromClerk, deleteMembershipFromClerk, etc.
  - Size: ~585 lines

#### Configuration
- **`/apps/backend/convex/schema.ts`** ⭐
  - Main schema definition file
  - Imports and registers: organizationInvitationsTable
  - Defines all table relationships

- **`/apps/backend/convex/http.ts`**
  - HTTP endpoints definition
  - Clerk webhooks handler
  - Referenced for API structure

### GENERATED/COMPILED FILES (AUTO-UPDATED)
- **`/apps/backend/convex/_generated/api.d.ts`**
  - TypeScript type definitions for all queries/mutations
  - Auto-generated from convex functions
  - Referenced by frontend via `api.organizations.mutations.*`

- **`/apps/backend/convex/_generated/api.js`**
  - JavaScript API client
  - Auto-generated

- **`/apps/backend/convex/_generated/server.d.ts`** / `.js`
  - Server-side type definitions and utilities
  - Auto-generated

---

## File Dependencies Map

### Frontend to Backend

```
InviteMemberDialog.tsx
  └─ useMutation(api.organizations.mutations.createInvitation)
     └─ Backend: organizations/mutations.ts → createInvitation()

PendingInvitationsList.tsx
  ├─ useMutation(api.organizations.mutations.cancelInvitation)
  │  └─ Backend: organizations/mutations.ts → cancelInvitation()
  └─ Component receives invitations prop from parent

TeamSettings/index.tsx
  └─ useQuery(api.organizations.queries.getPendingInvitations)
     └─ Backend: organizations/queries.ts → getPendingInvitations()

MembersList.tsx
  └─ useQuery(api.organizations.queries.getOrganizationMembers)
     └─ Backend: organizations/queries.ts → getOrganizationMembers()

ManageMemberDialog.tsx
  ├─ useMutation(api.organizations.mutations.updateMemberRole)
  ├─ useMutation(api.organizations.mutations.updateMemberStatus)
  ├─ useMutation(api.organizations.mutations.suspendMember)
  ├─ useMutation(api.organizations.mutations.reactivateMember)
  └─ useMutation(api.organizations.mutations.removeMember)
     └─ All in: organizations/mutations.ts
```

### Backend Internal Dependencies

```
organizations/mutations.ts
  ├─ imports: auth.ts (adminMutation wrapper)
  ├─ imports: schemas/organization_invitations.ts
  ├─ imports: schemas/organizations.ts
  ├─ imports: schemas/organization_members.ts
  ├─ queries:
  │  ├─ db.query("users")
  │  ├─ db.query("organization_members")
  │  ├─ db.query("organizations")
  │  └─ db.query("organization_invitations")
  └─ writes:
     ├─ db.insert("organization_members")
     ├─ db.insert("organization_invitations")
     ├─ db.patch(memberId, {...})
     └─ db.delete(invitationId)

organizations/queries.ts
  ├─ imports: auth.ts (authQuery wrapper)
  ├─ imports: auth.utils.ts (hasPermission, permissions)
  └─ queries:
     ├─ db.query("users")
     ├─ db.query("organization_members")
     ├─ db.query("organizations")
     └─ db.query("organization_invitations")

schema.ts
  ├─ imports: schemas/organization_invitations.ts
  ├─ imports: schemas/organization_members.ts
  ├─ imports: schemas/organizations.ts
  ├─ imports: schemas/users.ts
  └─ register all tables
```

---

## Critical Code Sections

### Invitation Creation Logic (createInvitation)
**Location**: `/apps/backend/convex/organizations/mutations.ts` (lines 509-600)

Key steps:
1. Validate email format
2. Check if user exists with that email
3. If exists: check if already member, then add directly
4. If not exists: check for existing pending invitation, then create new
5. Generate token: `crypto.randomUUID()`
6. Set expiration: `Date.now() + 7 * 24 * 60 * 60 * 1000`

### Invitation Cancellation Logic (cancelInvitation)
**Location**: `/apps/backend/convex/organizations/mutations.ts` (lines 605-633)

Key steps:
1. Fetch invitation from DB
2. Verify belongs to current organization
3. Check status is "pending"
4. Delete the record

### Pending Invitations Query (getPendingInvitations)
**Location**: `/apps/backend/convex/organizations/queries.ts` (lines 124-180)

Key steps:
1. Check user has access to organization
2. Check permission: `ORG_USERS_INVITE`
3. Query invitations with status = "pending"
4. Fetch inviter details for each
5. Sort by most recent first

---

## Enum & Type Definitions

### Invitation Roles
```typescript
"admin" | "member" | "viewer"
```
(Note: "owner" is not allowed for invitations, only for direct members)

### Invitation Status
```typescript
"pending" | "accepted" | "declined" | "expired"
```
(Currently only "pending" is used in the system)

### Member Status
```typescript
"active" | "inactive" | "suspended" | "pending" | "blocked"
```

### Member Roles
```typescript
"owner" | "admin" | "member" | "viewer" | "system"
```

---

## Database Query Patterns

### Find invitation by ID
```typescript
const invitation = await ctx.db.get(invitationId)
```

### Find invitations for organization
```typescript
const invitations = await ctx.db
  .query("organization_invitations")
  .withIndex("by_organization", q => q.eq("organizationId", orgId))
  .filter(q => q.eq(q.field("status"), "pending"))
  .collect()
```

### Find invitation by token
```typescript
const invitation = await ctx.db
  .query("organization_invitations")
  .withIndex("by_token", q => q.eq("token", token))
  .first()
```

### Find invitation by email (with org check)
```typescript
const invitation = await ctx.db
  .query("organization_invitations")
  .withIndex("by_email", q => q.eq("email", email))
  .filter(q => 
    q.and(
      q.eq(q.field("organizationId"), organization._id),
      q.eq(q.field("status"), "pending")
    )
  )
  .first()
```

### Find existing member (user + org)
```typescript
const membership = await ctx.db
  .query("organization_members")
  .withIndex("by_user_organization", q =>
    q.eq("userId", userId).eq("organizationId", organizationId)
  )
  .first()
```

---

## API Type Definitions

### createInvitation Input
```typescript
{
  email: string,
  role: "admin" | "member" | "viewer"
}
```

### createInvitation Output
```typescript
{
  id: string,
  addedDirectly: boolean,
  message: string
}
```

### cancelInvitation Input
```typescript
{
  invitationId: v.id("organization_invitations")
}
```

### cancelInvitation Output
```typescript
{
  success: boolean
}
```

### getPendingInvitations Input
```typescript
{
  organizationId: v.id("organizations")
}
```

### getPendingInvitations Output
```typescript
{
  id: Id<"organization_invitations">,
  email: string,
  role: "admin" | "member" | "viewer",
  status: "pending",
  invitedAt: number,
  expiresAt: number,
  inviterName: string,
  inviterEmail: string
}[]
```

---

## Testing Guide

### Frontend Component Testing
- Test InviteMemberDialog form validation
- Test email pattern validation
- Test role selection
- Test toast notifications
- Test form reset on close

### Backend Mutation Testing
- Test createInvitation with new email
- Test createInvitation with existing user email
- Test createInvitation with already-member email
- Test createInvitation with duplicate pending invitation
- Test cancelInvitation for pending invitations
- Test cancelInvitation permission checks
- Test permission validation (non-admin users)

### Integration Testing
- Invite new user, verify invitation record created
- Invite existing user, verify added directly
- View pending invitations list
- Cancel invitation, verify removal from list
- Check expiration date validity

---

## Development Notes

### Currently Working
- All invitation creation logic ✓
- All cancellation logic ✓
- All pending invitations viewing ✓
- All member management (role/status/removal) ✓
- Permission checks on all operations ✓

### TODO / Not Implemented
- Email sending service integration
- Invitation acceptance endpoint
- Invitation acceptance UI
- Automatic expiration cleanup
- Resend invitation functionality
- Bulk invitation upload
- Rate limiting on invitations

### Considerations for Next Phase
1. **Email Service**: Need to integrate Sendgrid, Resend, or similar
2. **Accept Flow**: Create public `/accept/:token` endpoint and page
3. **Status Tracking**: Implement state transitions (pending → accepted → active member)
4. **Expiration Job**: Add scheduled job to mark/clean up expired invitations
5. **Error Handling**: Consider handling cases like:
   - User signs up with different email than invited
   - Invitation expires before acceptance
   - User already joined via Clerk before accepting invite

