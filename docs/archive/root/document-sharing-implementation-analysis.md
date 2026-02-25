# Document Sharing & Team Collaboration - Current Implementation Analysis

## Executive Summary

The Seal codebase has a robust foundation for team collaboration and document sharing, with completed work on team/organization management (SEA-142, 143, 144) and a comprehensive permission system. However, **there is currently NO document storage schema or file upload implementation** - the infrastructure for storing documents themselves is missing.

---

## 1. DOCUMENT/FILE STORAGE IMPLEMENTATION

### Current State: NOT IMPLEMENTED

**Finding**: No document or file storage tables exist in the Convex schema.

```
Missing Tables:
- documents (for storing document metadata)
- files/storage (for file content)
- document_access (for per-document permissions)
- document_sharing (for sharing records)
```

**Current Schema Tables** (from `/apps/backend/convex/schema.ts`):

- `users` - User accounts
- `organizations` - Workspaces/teams
- `organization_members` - Team membership with role-based permissions
- `organization_invitations` - Pending member invitations
- `subscriptions` - Billing/subscription data
- `subscription_products` - Product definitions
- `subscription_prices` - Price tier data

### Required Implementation Work

To support document sharing, you'll need to create:

1. **Documents Table**
   - Store document metadata: name, type, size, created/updated timestamps
   - Link to organization (workspace scoping)
   - Link to owner (user who created it)
   - Sharing mode: private/team/specific-members/external
   - Status tracking: draft/ready/archived/deleted

2. **File Storage**
   - Convex File Storage API for actual file content
   - Or S3/external storage with URLs stored in database
   - File versioning support

3. **Document Access Control Table**
   - Map documents to users with permission levels
   - Permission hierarchy: view/edit/manage
   - Timestamp for audit trails

Example schema structure needed:

```typescript
// Documents Table
documentId -> organizationId (workspace scoping)
documentId -> ownerId (document creator/owner)
documentId -> sharingMode ("private" | "workspace" | "specific" | "external")
documentId -> permissions[] (for specific sharing)

// Document Permissions
userId -> documentId -> level ("view" | "edit" | "manage")
userId -> documentId -> grantedBy (who gave permission)
userId -> documentId -> grantedAt (timestamp for audit)
```

---

## 2. TEAM AND PERMISSIONS SYSTEM

### Current Implementation: FULLY IMPLEMENTED ✅

#### A. Team/Organization Structure

**Organizations Table** (`/apps/backend/convex/schemas/organizations.ts`):

```typescript
{
  name: string,              // Workspace name
  slug: string,              // URL-friendly identifier (indexed)
  type: "personal" | "group" | "company",
  logo?: string,
  metadata?: string,
  currency?: string,         // Default: BRL
  timezone: string,          // Default: UTC
  isActive: boolean,
  clerkId?: string,          // Clerk organization integration
  updatedAt: number
}

// Indexes:
- by_slug        (fast workspace lookups)
- by_type        (filter by org type)
- by_active      (active/inactive orgs)
- by_clerk_id    (Clerk sync)
```

#### B. Team Members & Roles

**Organization Members Table** (`/apps/backend/convex/schemas/organization_members.ts`):

```typescript
{
  userId: Id<"users">,
  organizationId: Id<"organizations">,

  // Role-based permissions
  role: "system" | "owner" | "admin" | "member" | "viewer",

  // Individual permission overrides
  permissions?: string[],

  status: "active" | "inactive" | "suspended" | "pending",
  isPrimary: boolean,        // Primary workspace for user
  externalId?: string
}

// Indexes:
- by_user                    (all user's memberships)
- by_organization            (all org members)
- by_user_organization       (specific membership)
- by_user_primary            (primary workspace)
- by_organization_status     (active members in org)
- by_user_status             (user's status across orgs)
```

**User Status Values**:

- `active` - User is active
- `inactive` - User is inactive
- `suspended` - User is suspended
- `pending` - User has not completed onboarding
- `blocked` - User is blocked

**Role Hierarchy** (from `/apps/backend/convex/auth.utils.ts`):

```
system: 150      (System admin - highest level)
owner: 100       (Workspace owner)
admin: 75        (Workspace administrator)
member: 50       (Regular member)
viewer: 25       (Read-only access - lowest)
```

#### C. Comprehensive Permission System

**Location**: `/apps/backend/convex/auth.utils.ts`

The system implements a **role-based + individual permission** hybrid:

1. **Base Role Permissions** - Automatically granted by role
2. **Individual Permission Overrides** - Custom permissions per user

**Role-Based Permission Matrix**:

| Domain                | Owner   | Admin          | Member      | Viewer  |
| --------------------- | ------- | -------------- | ----------- | ------- |
| **Org Management**    | ✅ Full | ✅ Limited     | ❌          | ❌      |
| **Member Management** | ✅ Full | ✅ Invite only | ❌          | ❌      |
| **Subscription**      | ✅ Full | ✅ View only   | ❌          | ❌      |
| **Documents**         | ✅ Full | ✅ Full        | ✅ Own docs | ✅ View |
| **Templates**         | ✅ Full | ✅ Full        | ✅ Own      | ✅ View |
| **Signatures**        | ✅ Full | ✅ Full        | ✅ Own      | ✅ View |
| **API/Webhooks**      | ✅ Full | ✅ Full        | ❌          | ❌      |
| **Audit**             | ✅ Full | ✅ View        | ❌          | ❌      |

**Permission Constants** (60+ permissions defined):

```typescript
// Organization
"org:manage";
"org:settings:read|update";
"org:users:read|invite|remove|update_role";

// Subscriptions
"subscription:manage|billing:read|billing:update";

// Documents (KEY FOR YOUR USE CASE)
"documents:read|create|update|delete|send|cancel|download";

// Templates
"templates:read|create|update|delete|use";

// Signatures
"signatures:read|download";

// API & Webhooks
"api:read|create|delete";
"webhooks:read|create|update|delete";

// Audit & Data
"audit:read|export";
"data:export|backup";

// Analytics
"analytics:read";
"reports:read|generate";
```

**Helper Functions** (comprehensive permission checking):

```typescript
// Core functions
hasPermission(member, permission); // Check single permission
hasRole(member, requiredRole); // Role hierarchy check
getEffectivePermissions(member); // All permissions (role + individual)
isAccountValid(member); // Account status check
canAccessOrganization(member, orgId); // Workspace isolation

// Document-specific helpers
canManageDocuments(member, orgId); // Create/update/delete
canSendDocuments(member); // Send for signing
canDownloadDocuments(member); // Download capability
canManageTemplates(member, orgId); // Template management

// And 15+ more specific helpers for different features
```

**Account Status Rules**:

- Only `active` members can perform actions
- `suspended`, `pending`, `blocked` cannot act
- Permission checks automatically fail for inactive accounts

#### D. Member Invitation System

**Invitations Table** (`/apps/backend/convex/schemas/organization_invitations.ts`):

```typescript
{
  organizationId: Id<"organizations">,
  email: string,
  role: "system" | "owner" | "admin" | "member" | "viewer",
  status: "pending" | "accepted" | "declined" | "expired",

  token: string,               // Unique invitation token
  invitedBy: Id<"users">,      // Who sent the invitation
  acceptedBy?: Id<"users">,    // Who accepted it
  acceptedAt?: number,

  expiresAt: number,           // 7 days default
  createdAt: number
}

// Indexes:
- by_organization    (find pending invites)
- by_email          (check for duplicate invites)
- by_token          (accept invitation)
```

**Invitation Workflow**:

1. Owner/Admin invites user by email
2. Invitation stored with 7-day expiration
3. User accepts via invitation link/token
4. User created or added to organization
5. Invitation marked as `accepted`

---

## 3. EXISTING SHARING OR ACCESS CONTROL

### Current Implementation: PARTIAL ✅

#### A. What DOES Exist

1. **Organization-Level Access Control**
   - Users can only see/manage data in organizations they belong to
   - Strong workspace isolation via `by_user_organization` queries
   - All queries verify user has membership before returning data

2. **Role-Based Access Control (RBAC)**
   - Verified in `/apps/backend/convex/organizations/queries.ts`
   - `getOrganization` - Checks user has membership
   - `getOrganizationMembers` - Only members can view
   - `getPendingInvitations` - Only admins/owners can view
   - `getUserPermissions` - Returns detailed permission set
   - `getOrganizationMemberCount` - Restricted access

3. **Permission Checking Patterns**

   ```typescript
   // Pattern used throughout backend:
   const member = await ctx.db
     .query("organization_members")
     .withIndex("by_user_organization", (q) =>
       q.eq("userId", ctx.auth.user._id).eq("organizationId", orgId),
     )
     .first();

   if (!member) {
     throw new ConvexError("No access to this organization");
   }

   if (!hasPermission(member, DOCUMENT_SIGNING_PERMISSIONS.REQUIRED_PERM)) {
     throw new ConvexError("Insufficient permissions");
   }
   ```

#### B. What DOES NOT Exist

1. **Per-Document Access Control**
   - No way to grant/deny access to specific documents
   - No document permission inheritance model
   - No "share with specific team members" functionality

2. **Document Sharing Modes**
   - Private (owner only) - CAN be implemented with simple ownership check
   - Team-wide sharing - CAN be implemented by checking organization membership
   - Specific members only - REQUIRES document_access table
   - External sharing - REQUIRES external access tokens/links

3. **Sharing Audit Trail**
   - No sharing history/audit logs
   - No notification system for shared documents
   - No access change tracking

---

## 4. DOCUMENT STORAGE & RETRIEVAL PATTERNS

### How to Implement File Storage

Convex offers two approaches:

#### Option A: Convex File Storage (Recommended)

```typescript
// Upload:
const storageId = await ctx.storage.generateUploadUrl();
// Frontend uploads to this URL

// Store in database:
const docId = await ctx.db.insert("documents", {
  name: "contract.pdf",
  storageId: storageId, // Reference to file storage
  organizationId,
  ownerId,
  // ...
});

// Retrieve:
const file = await ctx.storage.getUrl(storageId);
```

#### Option B: External Storage (S3/GCS)

```typescript
// Store signed URLs in database
const docId = await ctx.db.insert("documents", {
  name: "contract.pdf",
  fileUrl: "https://s3.amazonaws.com/...",
  organizationId,
  ownerId,
  // ...
});
```

---

## 5. AUTHENTICATION & AUTHORIZATION SETUP

### Current Setup

**Auth Implementation** (`/apps/backend/convex/auth.ts`, `auth.utils.ts`):

1. **Clerk Integration**
   - User identity verification via Clerk webhooks
   - Organization sync from Clerk
   - JWT token validation

2. **Custom Auth Wrappers**

   ```typescript
   // authQuery - Requires authenticated user
   export const authQuery = (config) => {
     return query({
       args: config.args,
       handler: async (ctx, args) => {
         const { user, auth } = await authenticateUser(ctx);
         return config.handler({ ...ctx, auth: { user, ... } }, args);
       }
     });
   };

   // adminMutation - Requires organization admin+
   export const adminMutation = (config) => {
     // Validates user is admin/owner of organization
   };
   ```

3. **User Context Available in Handlers**
   - `ctx.auth.user._id` - Current user ID
   - `ctx.auth.organization._id` - Current workspace ID
   - `ctx.auth.membership` - User's role/permissions in org

---

## 6. DESIGN SPECIFICATIONS FOR SHARING

The codebase includes **comprehensive wireframes and specifications** for document sharing:

### Document Sharing Modes (Designed)

1. **Private** (default)
   - Only owner can access
   - Storage/permission: Check `document.ownerId === currentUserId`

2. **Workspace/Team Shared**
   - All organization members can access
   - Storage/permission: Check `organizationMembership exists`

3. **Specific Members**
   - Select team members only
   - Storage/permission: Check `document_access` table

4. **External Link**
   - Public shareable link
   - Storage/permission: Share tokens/public URLs

### Permission Levels (Designed)

- **Can View** - Read-only access
- **Can Edit** - Modify document content and fields
- **Can Manage** - Edit + manage sharing settings + transfer ownership

### Features Specified

1. Document Access Modal
   - Show current sharing mode
   - Change sharing permissions
   - Add/remove team members
   - Per-member permission control

2. Ownership Transfer
   - Transfer document to another team member
   - Original owner retains "Can Edit" permission
   - Activity log updated
   - Team notified

3. Team Document Library
   - Filter: All / Shared / Private
   - Show owner and access level per document
   - Quick access controls

---

## 7. RELATED COMPLETED WORK

### SEA-142, 143, 144 - Role-Based Permissions (COMPLETED)

These tickets implemented the foundation:

- ✅ Role hierarchy system (5 roles: system, owner, admin, member, viewer)
- ✅ 60+ permission strings for granular control
- ✅ Permission checking functions and helpers
- ✅ Role-based access control implementation
- ✅ Clerk RBAC plugin integration

Located in: `/apps/backend/convex/auth.utils.ts`

---

## 8. KEY TECHNICAL PATTERNS USED

### Query Access Control Pattern

```typescript
// All queries follow this pattern:
export const getOrganization = authQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!org) throw new ConvexError("Organization not found");

    // CRITICAL: Verify user has access
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", org._id),
      )
      .first();

    if (!member) throw new ConvexError("No access to this organization");

    // Now safe to return data
    return { ...org, userRole: member.role };
  },
});
```

### Index Usage for Performance

All tables are properly indexed:

- Foreign keys indexed (userId, organizationId, etc.)
- Composite indexes for common queries (userId + organizationId)
- Status filtering indexes

### Transaction Safety

- Convex mutations are ACID-compliant
- No manual transaction management needed
- Automatic rollback on errors

---

## 9. IMPLEMENTATION ROADMAP

To add document sharing functionality:

### Phase 1: Document Storage (Required First)

- [ ] Create `documents` table schema
- [ ] Implement file upload/storage (Convex or S3)
- [ ] Create document queries (get, list, search)
- [ ] Create document mutations (create, update, delete)

### Phase 2: Document-Level Permissions

- [ ] Create `document_access` table for specific member sharing
- [ ] Implement permission checking in document queries
- [ ] Add permission mutation handlers

### Phase 3: Sharing UI & API

- [ ] Document sharing modal API endpoint
- [ ] Permission update endpoints
- [ ] Ownership transfer endpoint
- [ ] Document library with sharing filters

### Phase 4: Notifications & Audit

- [ ] Document sharing notifications (via Resend)
- [ ] Activity/audit log for documents
- [ ] Real-time updates (Convex subscriptions)

### Phase 5: Free Plan Limitations

- [ ] Implement plan-based sharing restrictions
- [ ] Free plan: external sharing only
- [ ] Pro plan: team sharing enabled

---

## 10. FILES TO EXAMINE FOR IMPLEMENTATION DETAILS

### Backend Structure

```
/apps/backend/convex/
├── schema.ts                              # Main schema definitions
├── auth.ts                                # Authentication setup
├── auth.utils.ts                          # Permission helpers (KEY FILE)
├── check_membership.ts                    # Membership queries
├── schemas/
│   ├── organizations.ts                   # Organization schema
│   ├── organization_members.ts            # Membership + roles
│   ├── organization_invitations.ts        # Invitations
│   ├── users.ts                           # User schema
│   └── subscriptions.ts                   # Billing
└── organizations/
    ├── queries.ts                         # Organization queries (REFERENCE PATTERNS)
    └── mutations.ts                       # Organization mutations (REFERENCE PATTERNS)
```

### Design & Specification Documents

```
/docs/features/workspace-management/team-collaboration/
├── wireframes/02-document-sharing.md      # Complete sharing UI specs
├── feature-spec.md                        # Detailed requirements
└── user-flows.md                          # User interaction flows

/docs/design-phase/information-architecture/
└── user-permissions-matrix.md             # Full permission matrix
```

---

## 11. SUMMARY & RECOMMENDATIONS

### What Works Today ✅

- Organization/workspace management
- Team member management and invitations
- Comprehensive role-based permission system
- Organization-level access control
- User authentication and authorization

### What's Missing ❌

- Document storage schema
- File upload/storage implementation
- Per-document access control
- Document-specific permission checking
- Document sharing UI and API

### Next Steps

1. **Design document schema** - Decide on metadata needed
2. **Choose storage solution** - Convex Files vs. S3/external
3. **Implement `documents` table** - With all necessary indexes
4. **Add document queries/mutations** - Follow existing patterns
5. **Implement permission checks** - Extend auth.utils helpers
6. **Build sharing API** - Create endpoints for sharing operations
7. **Add notification system** - Notify users of shared documents

The permission system is already robust and ready for document-level scoping. You can reuse many of the patterns and helpers already implemented for team management.
