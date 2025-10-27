# Seal Project - Comprehensive Invitation System Exploration

## Overview
The Seal project has a **complete invitation system** already implemented for team member management. This document provides a thorough inventory of all existing invitation-related code.

---

## FRONTEND COMPONENTS (apps/web/src/components/team/)

### 1. InviteMemberDialog Component
**File**: `/apps/web/src/components/team/invite-member-dialog.tsx`

**Purpose**: Modal dialog for inviting new team members to an organization

**Key Features**:
- Email validation
- Role selection (admin, member, viewer)
- Error handling with toast notifications
- Form reset on close
- Calls `api.organizations.mutations.createInvitation`

**Functionality**:
- Takes `organizationId` as prop
- Returns success/error toasts
- Distinguishes between "added directly" (existing user) vs "invited" (new user)
- Shows user-friendly feedback messages

**State Management**:
- `email`: string
- `role`: "admin" | "member" | "viewer"
- `error`: string | null
- `isSubmitting`: boolean

---

### 2. PendingInvitationsList Component
**File**: `/apps/web/src/components/team/pending-invitations-list.tsx`

**Purpose**: Displays table of pending invitations with management options

**Key Features**:
- Shows invitation email, role, inviter, sent date, expiration
- Cancel invitation functionality
- Expiration status indicator (expired badge)
- Time-ago formatting for "sent" date
- Color-coded role badges

**Interface**:
```typescript
interface Invitation {
  id: Id<"organization_invitations">;
  email: string;
  role: "admin" | "member" | "viewer";
  status: "pending" | "accepted" | "declined" | "expired";
  invitedAt: number;
  expiresAt: number;
  inviterName: string;
  inviterEmail: string;
}
```

**Actions**:
- Cancel invitation with confirmation toast
- Visual indicators for expired invitations

---

### 3. MembersList Component
**File**: `/apps/web/src/components/team/members-list.tsx`

**Purpose**: Display active organization members with management options

**Features**:
- Member search functionality
- Role display and inline role selector (for admins)
- Status badges (active, inactive, suspended, pending, blocked)
- Join date display
- Avatar with fallback initials
- Integration with ManageMemberDialog

**Role Hierarchy Display**:
- owner: purple badge
- admin: blue badge
- member: green badge
- viewer: gray badge
- system: red badge

---

### 4. ManageMemberDialog Component
**File**: `/apps/web/src/components/team/manage-member-dialog.tsx`

**Purpose**: Modal for managing active member roles and status

**Key Features**:
- Role selection dropdown (except for owners)
- Status selection (active, inactive, suspended, pending)
- Quick action buttons:
  - Suspend Member (for non-suspended, non-owner members)
  - Reactivate Member (for suspended/inactive)
  - Remove from Workspace (with confirmation)
- Save changes functionality
- Toast notifications for success/error

**Mutations Used**:
- `updateMemberRole`
- `updateMemberStatus`
- `suspendMember`
- `reactivateMember`
- `removeMember`

---

## BACKEND - DATABASE SCHEMA

### Organization Invitations Table
**File**: `/apps/backend/convex/schemas/organization_invitations.ts`

**Schema Definition**:
```typescript
{
  organizationId: v.id("organizations"),
  email: string,
  role: "admin" | "member" | "viewer",
  status: "pending" | "accepted" | "declined" | "expired",
  token: string,                    // Unique invitation token (UUID)
  invitedBy: v.id("users"),        // ID of user who sent invitation
  acceptedBy: v.optional(v.id("users")),
  acceptedAt: v.optional(v.number()),
  expiresAt: v.number(),            // Expiration timestamp
  createdAt: v.number(),
}
```

**Indexes**:
- `by_organization`: Fast lookup of invitations for an organization
- `by_email`: Find invitations by email address
- `by_token`: Find invitation by token (for accepting invites)

---

## BACKEND - MUTATIONS & QUERIES

### Key Mutations in organizations/mutations.ts

#### 1. createInvitation
**Purpose**: Create invitation for new member or add existing user directly

**Logic**:
1. Validates email format
2. Checks if user already exists:
   - If YES and NOT a member: Add directly to organization_members (returns `addedDirectly: true`)
   - If YES and IS a member: Throw error "User is already a member"
   - If NO: Create invitation entry
3. Checks for existing pending invitation for that email
4. Generates unique token: `crypto.randomUUID()`
5. Sets expiration: `Date.now() + 7 * 24 * 60 * 60 * 1000` (7 days)

**Input Args**:
```typescript
{
  email: string,
  role: "admin" | "member" | "viewer"
}
```

**Return**:
```typescript
{
  id: string,
  addedDirectly: boolean,
  message: string
}
```

---

#### 2. cancelInvitation
**Purpose**: Cancel a pending invitation

**Logic**:
1. Fetch invitation by ID
2. Verify it belongs to current organization
3. Check status is "pending" (can only cancel pending invitations)
4. Delete the invitation record

**Input Args**:
```typescript
{
  invitationId: v.id("organization_invitations")
}
```

---

#### 3. addMember / updateMemberRole / updateMemberStatus / removeMember / suspendMember / reactivateMember
**Purpose**: Manage active members

**Each includes**:
- Organization membership verification
- Permission checks where appropriate
- Status/role update logic
- Owner protection (can't change own role, can't remove last owner, etc.)

---

### Key Queries in organizations/queries.ts

#### 1. getPendingInvitations
**Purpose**: Retrieve all pending invitations for an organization

**Logic**:
1. Verify user has access to organization
2. Check permission: `ORG_USERS_INVITE`
3. Query invitations with status = "pending"
4. Fetch inviter details for each invitation
5. Sort by most recent first

**Return Type**:
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

#### 2. getOrganizationMembers
**Purpose**: Get all members of organization with user details

**Features**:
- Fetches members with full user details (name, email, avatar)
- Sorts by role hierarchy and join date
- Returns comprehensive member information

---

#### 3. getUserPermissions
**Purpose**: Get user's permissions for current organization

**Returns**:
```typescript
{
  role: string,
  status: string,
  isPrimary: boolean,
  permissions: {
    canInviteMembers: boolean,
    canRemoveMembers: boolean,
    canUpdateRoles: boolean,
    // ... 20+ permission flags
  }
}
```

---

## FRONTEND - ROUTES & PAGES

### Team Settings Page
**File**: `/apps/web/src/routes/_authenticated/$slug/settings/team/index.tsx`

**Purpose**: Main team management interface

**Components**:
- InviteMemberDialog (for inviting new members)
- MembersList (display of current members)
- PendingInvitationsList (display of pending invitations)
- Tabs interface: "Members" and "Invitations" tabs

**Queries Used**:
- `getOrganization` (by slug)
- `getUserPermissions` (to check canInviteMembers)
- `getOrganizationMembers`
- `getPendingInvitations` (only if canInviteMembers)

**Features**:
- "Invite Member" button (only if user has permission)
- Invitation count badge in tab
- Conditional rendering based on permissions

---

### Team Layout
**File**: `/apps/web/src/routes/_authenticated/$slug/settings/team.tsx`

**Purpose**: Layout wrapper for team routes

**Structure**: Simple `<Outlet />` for nested routes

---

### Member Details Route
**File**: `/apps/web/src/routes/_authenticated/$slug/settings/team/$memberId.tsx`

**Purpose**: Individual member detail/management page

---

## WEBHOOK INTEGRATION

**File**: `/apps/backend/convex/webhooks.ts`

**Clerk-Related Functions** (relevant to invitations):
- `syncOrganizationMembership`: Syncs organization membership from Clerk webhook
- `upsertMembershipFromClerk`: Enhanced membership upsert with retry logic
- `syncMembershipFromClerk`: Membership sync
- `removOrganizationMembership`: Removes membership from Clerk webhook
- `deleteMembershipFromClerk`: Deletes membership

**Note**: Current implementation uses Clerk for managing direct organization membership. Invitations are handled separately via the custom `organization_invitations` table.

---

## PERMISSION SYSTEM

### Key Permission: ORG_USERS_INVITE
**Location**: `/apps/backend/convex/auth.utils.ts`

**Permission ID**: `"org:users:invite"`

**Granted to**:
- Owner: YES
- Admin: YES
- Member: NO
- Viewer: NO

**Usage**: 
- Only admins/owners can view pending invitations
- Only admins/owners can create invitations
- Only admins/owners can cancel invitations

---

## AUTHENTICATION & CONTEXT

**File**: `/apps/backend/convex/auth.ts`

**Key Wrapper Functions**:
- `authQuery`: Requires authentication
- `authMutation`: Requires authentication
- `adminMutation`: Requires admin/owner permission in organization
- `ownerMutation`: Requires owner permission (currently not heavily used)

**Auth Context Includes**:
- `user`: Authenticated user document
- `organization`: Current organization
- `member`: User's membership in organization
- `hasPermission()`: Permission checking function

---

## SCHEMA RELATIONSHIPS

```
users (1) -----> (M) organization_members (1) ----> (M) organizations
         \                                              /
          \                                            /
           (M) organization_invitations <-----------/
                      |
                   email
                   role
                   token
```

**Key Relationships**:
1. User can have multiple organization memberships
2. Each organization can have multiple members
3. Each organization can have multiple pending invitations
4. Invitation has optional `acceptedBy` reference to users table

---

## WHAT'S WORKING

### Fully Implemented Features:
- ✅ Creating invitations with email and role
- ✅ Storing invitations with unique tokens and expiration (7 days)
- ✅ Pending invitations list with full details
- ✅ Canceling pending invitations
- ✅ Adding existing users directly if they have an account
- ✅ Permission-based access control (admin/owner only)
- ✅ Toast notifications for success/error
- ✅ Role selection (admin, member, viewer)
- ✅ Member management (suspend, reactivate, remove)
- ✅ Expiration tracking

---

## WHAT'S NOT IMPLEMENTED

### Missing/Incomplete Features:

1. **Email Sending**: No email sending logic found
   - Invitations are created but no emails are sent to invitees
   - No email templates
   - No email service integration (Sendgrid, Resend, etc.)

2. **Invitation Acceptance Flow**:
   - No `/accept-invite/:token` route
   - No invitation acceptance mutation
   - No public API endpoint to accept invitations
   - Invitations are never marked as "accepted" or "declined"

3. **Invitation Status Transitions**:
   - Status field exists in schema (pending, accepted, declined, expired)
   - Only "pending" is ever used
   - No mutations to accept/decline invitations
   - No automatic expiration cleanup

4. **Invitation Resend**:
   - No ability to resend invitations

5. **Bulk Invitation**:
   - Only one-at-a-time invitation in UI
   - Could potentially support bulk via API

6. **Invitation Links**:
   - Tokens are generated but not used
   - No way to generate magic links from tokens
   - No public landing page with token-based acceptance

---

## IMPLEMENTATION STATUS SUMMARY

| Feature | Status | Location |
|---------|--------|----------|
| Create Invitations | ✅ Complete | `organizations/mutations.ts` |
| List Pending Invitations | ✅ Complete | `organizations/queries.ts` |
| Cancel Invitations | ✅ Complete | `organizations/mutations.ts` |
| Direct Add (Existing Users) | ✅ Complete | `organizations/mutations.ts` |
| Invitation Storage | ✅ Complete | `schemas/organization_invitations.ts` |
| UI Components | ✅ Complete | `components/team/*` |
| Team Settings Page | ✅ Complete | `routes/_authenticated/$slug/settings/team/` |
| Permission Checks | ✅ Complete | `auth.utils.ts` |
| Email Sending | ❌ Missing | - |
| Accept Invitation Endpoint | ❌ Missing | - |
| Accept Invitation UI | ❌ Missing | - |
| Auto Expiration | ❌ Missing | - |
| Resend Invitations | ❌ Missing | - |

---

## CODE SNIPPETS FOR REFERENCE

### Create Invitation Flow
```
InviteMemberDialog (component)
  -> handleSubmit()
    -> useMutation(api.organizations.mutations.createInvitation)
      -> Backend validation & creation
      -> Returns { id, addedDirectly, message }
      -> Toast notification
```

### View Pending Invitations Flow
```
TeamSettings (page)
  -> useQuery(api.organizations.queries.getPendingInvitations)
    -> Backend permission check (ORG_USERS_INVITE)
    -> Fetch invitations with status="pending"
    -> Fetch inviter details
    -> Sort by recency
  -> PendingInvitationsList (component displays)
```

### Cancel Invitation Flow
```
PendingInvitationsList (component)
  -> handleCancelInvitation()
    -> useMutation(api.organizations.mutations.cancelInvitation)
      -> Backend deletion
      -> Toast notification
```

---

## Key Design Decisions Observed

1. **Token Storage**: Uses UUIDs for invitation tokens (good for security)
2. **Hybrid Approach**: Both direct addition (for existing users) and invitations (for new users)
3. **Permission-Based**: All invitation operations require admin/owner role
4. **7-Day Expiration**: Hardcoded in createInvitation mutation
5. **Clerk Integration**: Uses Clerk webhooks for membership sync (separate from invitations)
6. **Separate Workflow**: Invitations are handled separately from Clerk-managed memberships

---

## Files Changed in Working Directory

Based on git status, these invitation-related files have been modified:
- `apps/backend/convex/_generated/api.d.ts`
- `apps/backend/convex/http.ts`
- `apps/backend/convex/organizations/mutations.ts`
- `apps/backend/convex/organizations/queries.ts`
- `apps/backend/convex/schema.ts`
- `apps/web/src/components/team/invite-member-dialog.tsx`
- `apps/web/src/components/team/members-list.tsx`
- `apps/web/src/components/team/pending-invitations-list.tsx`
- `apps/web/src/routes/_authenticated/$slug/settings/team.tsx`

New files created:
- `apps/web/src/components/team/manage-member-dialog.tsx`
- `apps/backend/convex/schemas/organization_roles.ts`
- `apps/backend/convex/organization_roles/` (folder with helpers, mutations, queries)

