# Seal Invitation System - Architecture & Data Flow

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/TanStack Router)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Team Settings Page (/settings/team/index.tsx)                         │
│  ├── InviteMemberDialog    ────► Create new invitations               │
│  ├── MembersList           ────► Manage existing members              │
│  └── PendingInvitationsList ───► View & cancel pending invitations   │
│                                                                         │
│  Each component uses Convex hooks:                                      │
│  • useQuery(api.organizations.queries.*)                               │
│  • useMutation(api.organizations.mutations.*)                          │
│                                                                         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTP/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONVEX BACKEND (TypeScript)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ QUERIES (Read-only)                                               │
│  │  • getPendingInvitations(orgId)                                     │
│  │  • getOrganizationMembers(orgId)                                    │
│  │  • getUserPermissions(orgId)                                        │
│  │  • getOrganization(slug)                                            │
│  │                                                                     │
│  ├─ MUTATIONS (Write operations)                                      │
│  │  • createInvitation(email, role)                                   │
│  │    └─ Branch 1: User exists → Add directly to members             │
│  │    └─ Branch 2: User doesn't exist → Create invitation record     │
│  │  • cancelInvitation(invitationId)                                  │
│  │  • updateMemberRole(memberId, role)                               │
│  │  • updateMemberStatus(memberId, status)                           │
│  │  • removeMember(memberId)                                          │
│  │  • suspendMember(memberId)                                         │
│  │  • reactivateMember(memberId)                                      │
│  │                                                                     │
│  ├─ AUTH CONTEXT (Per request)                                        │
│  │  • User identity (from Clerk)                                      │
│  │  • Organization membership                                         │
│  │  • User permissions                                                │
│  │  • adminMutation wrapper for permission checks                     │
│  │                                                                     │
│  └─ PERMISSION CHECKS                                                 │
│     • ORG_USERS_INVITE (admin/owner only)                            │
│     • ORG_USERS_REMOVE (admin/owner only)                            │
│     • ORG_USERS_UPDATE_ROLE (admin/owner only)                       │
│                                                                         │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ Convex SDK
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     DATABASE (Convex Managed)                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TABLE: users                                                          │
│  ├─ _id (ID<"users">)                                                 │
│  ├─ clerkId (string)                                                   │
│  ├─ email (string)                                                     │
│  ├─ name (string)                                                      │
│  ├─ avatar (string)                                                    │
│  ├─ activeOrganizationId (ID<"organizations">)                        │
│  └─ Indexes: by_clerk_id, by_email                                    │
│                                                                         │
│  TABLE: organizations                                                  │
│  ├─ _id (ID<"organizations">)                                         │
│  ├─ name (string)                                                      │
│  ├─ slug (string)                                                      │
│  ├─ type ("personal" | "group" | "company")                          │
│  ├─ logo (string)                                                      │
│  ├─ timezone (string)                                                  │
│  ├─ clerkId (string) [for Clerk-synced orgs]                         │
│  └─ Indexes: by_slug, by_clerk_id                                     │
│                                                                         │
│  TABLE: organization_members                                           │
│  ├─ _id (ID<"organization_members">)                                  │
│  ├─ userId (ID<"users">)                                              │
│  ├─ organizationId (ID<"organizations">)                              │
│  ├─ role ("owner" | "admin" | "member" | "viewer" | "system")       │
│  ├─ status ("active" | "inactive" | "suspended" | "pending")        │
│  ├─ isPrimary (boolean)                                               │
│  ├─ permissions (string[])  [custom permission overrides]            │
│  ├─ clerkMembershipId (string) [for Clerk sync]                      │
│  └─ Indexes: by_user_organization, by_organization, by_user           │
│                                                                         │
│  TABLE: organization_invitations ⭐ [INVITATION DATA]                 │
│  ├─ _id (ID<"organization_invitations">)                              │
│  ├─ organizationId (ID<"organizations">)  ◄── Which org this is for  │
│  ├─ email (string)                        ◄── Who is invited         │
│  ├─ role ("admin" | "member" | "viewer")  ◄── Role if accepted      │
│  ├─ status ("pending"|"accepted"|...)     ◄── Invitation state       │
│  ├─ token (string)                        ◄── Magic link token      │
│  ├─ invitedBy (ID<"users">)              ◄── Who sent it            │
│  ├─ acceptedBy (ID<"users">) [optional]   ◄── Who accepted it       │
│  ├─ acceptedAt (number) [optional]        ◄── When they accepted     │
│  ├─ expiresAt (number)                    ◄── Expiration timestamp   │
│  ├─ createdAt (number)                    ◄── Creation timestamp     │
│  └─ Indexes: by_organization, by_email, by_token                     │
│                                                                         │
│  TABLE: organization_roles                                             │
│  └─ Custom role definitions (for advanced RBAC)                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Diagrams

### 1. Creating an Invitation

```
User clicks "Invite Member" button
        │
        ▼
InviteMemberDialog opens
        │
        ▼
User enters email + selects role
        │
        ▼
Form submission
        │
        ▼
createInvitation mutation called
        │
        ├──────────────────────────────────────────────┐
        │                                              │
        ▼                                              ▼
Check if user exists             User exists?         Check if user is a member
in database                            │                of this organization
        │                              │
        ├──────────────┐               │
        │              │               │
    NO │              YES              │
        │              │               │
        │              └─────┬─────────┘
        │                    │
        ▼                    ├─► YES: Throw Error (already member)
        │                    │
   Check for existing        └─► NO: Add directly to organization_members
   pending invitation             Return { addedDirectly: true }
        │
   ┌────┴────┐
   │ Found?  │
   │    │    │
YES│    │NO  │
   │    │    │
   │    ▼    ▼
   │  Throw Generate UUID
   │  Error  │
   │         ▼
   │    Create record in
   │    organization_invitations
   │    {
   │      email,
   │      role,
   │      token: UUID,
   │      status: "pending",
   │      invitedBy: currentUserId,
   │      expiresAt: now + 7 days
   │    }
   │         │
   ▼         ▼
Return id + addedDirectly flag
        │
        ▼
Toast notification to user
        │
        ▼
Dialog closes & form resets
```

### 2. Viewing Pending Invitations

```
Team Settings page loads
        │
        ▼
getPendingInvitations query executed
        │
        ▼
Backend checks:
├─ User authenticated?
├─ User has access to organization?
└─ User has ORG_USERS_INVITE permission?
        │
        ├──► NO on any check → throw error
        │
        ▼ YES on all
        │
Query database for invitations with:
├─ organizationId = current org
└─ status = "pending"
        │
        ▼
For each invitation, fetch:
├─ User details of invitedBy
├─ Format timestamps
└─ Build response object
        │
        ▼
Sort by most recent first
        │
        ▼
Return to frontend
        │
        ▼
PendingInvitationsList renders table
├─ Email column
├─ Role badge column
├─ Invited by column
├─ Sent (time ago) column
├─ Expires (date) column
│  ├─ If expired: Red "Expired" badge
│  └─ If valid: Formatted date
└─ Cancel button (per row)
```

### 3. Canceling an Invitation

```
User clicks X button on invitation row
        │
        ▼
handleCancelInvitation called
        │
        ▼
cancelInvitation mutation
        │
        ▼
Fetch invitation from DB
        │
        ▼
Verify:
├─ Invitation exists?
├─ Belongs to current org?
└─ Status is "pending"?
        │
        ├──► NO on any → throw error
        │
        ▼ YES on all
        │
Delete invitation record from DB
        │
        ▼
Return success
        │
        ▼
Toast notification: "Invitation cancelled"
        │
        ▼
UI updates automatically (Convex real-time)
```

---

## Permission Flow

```
adminMutation wrapper
        │
        ▼
Extract auth context:
├─ user (from Clerk token)
├─ organization (from route param)
└─ member (user's membership in org)
        │
        ▼
Check member.role:
├─ owner? ──► ALLOW
├─ admin? ──► ALLOW
├─ member? ──► DENY
├─ viewer? ──► DENY
└─ system? ──► ALLOW (if implemented)
        │
        ├──► DENY: throw ConvexError
        │
        ▼ ALLOW
        │
Execute mutation logic
```

---

## Data Relationships

### Scenario: Creating Invitation for New User

```
Step 1: User (admin) initiates invitation
┌────────────────────────────────────┐
│ Current User (Admin)               │
│ - _id: user_123 (from Clerk)      │
│ - email: admin@company.com        │
└────────────────────────────────────┘

Step 2: New invitation record created
┌────────────────────────────────────┐
│ organization_invitations record    │
│ - organizationId: org_456          │
│ - email: newmember@gmail.com       │
│ - role: "member"                   │
│ - token: "uuid-1234..."            │
│ - invitedBy: user_123 ────────┐    │
│ - status: "pending"           │    │
│ - expiresAt: now + 7 days     │    │
└───────────────────────┬────────┘    │
                        │             │
                        │ reference   │
                        └─────────────┘

Step 3: If user already exists in DB
┌────────────────────────────────────┐
│ users table                        │
│ - _id: user_789                    │
│ - email: newmember@gmail.com       │
│ - clerkId: "clerk_xyz..."          │
└────────────────────────────────────┘
        │
        ▼ Creates direct membership
┌────────────────────────────────────┐
│ organization_members record        │
│ - userId: user_789 ───────────┐    │
│ - organizationId: org_456      │    │
│ - role: "member"               │    │
│ - status: "active"             │    │
│ - _creationTime: now           │    │
└────────────────────────────────┘    │
        │                             │
        └─────────────────────────────┘

Step 4: If user doesn't exist yet
        → Invitation record stored
        → No user record created
        → Waiting for email acceptance
        → (Currently no acceptance flow)
```

---

## Current Limitations

### What's Missing

1. **Email Communication**
   - Invitation emails NOT sent
   - No email templates
   - Token is generated but not used

2. **Acceptance Flow**
   - No public `/accept/:token` endpoint
   - No acceptance UI/page
   - Invitations never transition from "pending" → "accepted"

3. **Expiration Handling**
   - Expiration date stored but not enforced
   - No cleanup of expired invitations
   - Frontend shows "Expired" badge but invitation still exists

4. **Resend Capability**
   - No resend button in UI
   - No resend mutation

5. **Bulk Operations**
   - Only single invitations via UI
   - No CSV import or bulk invite

---

## Integration Points

### With Clerk
- Clerk webhooks sync direct organization membership
- Invitations are separate from Clerk's direct membership
- When invited user signs up with Clerk, they still need to accept the invitation
- OR they're added directly if they already have a Clerk account

### With Permission System
- All invitation operations protected by `adminMutation`
- Requires `ORG_USERS_INVITE` permission
- Owner/Admin can perform all operations
- Member/Viewer cannot see invitations

### With Organization Management
- Invitations scoped to organization via `organizationId`
- Deletion of organization also deletes all invitations
- Query checks organization membership for auth

---

## Code Execution Path Example

### Creating an Invitation (End-to-End)

```typescript
// FRONTEND - User clicks Invite
onClick={() => handleSubmit(e)}
  ↓
// FRONTEND - Make mutation call
await createInvitation({ email, role })
  ↓
// BACKEND - Validate input & auth
adminMutation({
  handler: async (ctx, args) => {
    // ctx.auth contains:
    // - user: from Clerk token
    // - organization: from request context
    // - member: user's membership
    // 
    // Implicit check: user must be admin/owner
    
    // Step 1: Email validation
    if (!email.includes("@")) throw error
    
    // Step 2: Check if user exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", email))
      .first()
    
    if (existingUser) {
      // Step 3a: Check if already member
      const existingMembership = await ctx.db
        .query("organization_members")
        .withIndex("by_user_organization", q =>
          q.eq("userId", existingUser._id)
           .eq("organizationId", organization._id)
        )
        .first()
      
      if (existingMembership) throw error
      
      // Step 3b: Add directly
      await ctx.db.insert("organization_members", {...})
      return { addedDirectly: true }
    }
    
    // Step 4: Create invitation for new user
    const token = crypto.randomUUID()
    await ctx.db.insert("organization_invitations", {
      organizationId: organization._id,
      email,
      role,
      token,
      invitedBy: user._id,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      status: "pending"
    })
    
    return { addedDirectly: false }
  }
})
  ↓
// BACKEND - Return result
  ↓
// FRONTEND - Handle response
if (result.addedDirectly) {
  toast.success("Member added")
} else {
  toast.success("Invitation sent")
}
  ↓
// FRONTEND - Update UI
resetForm()
closeDialog()
```

