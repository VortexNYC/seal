# Document Sharing Implementation - Quick Reference

## Current State Summary

### ✅ FULLY IMPLEMENTED

- **Organization/Workspace Management** - Multi-workspace support with teams
- **Team Member Management** - Invitations, roles, status tracking
- **Role-Based Permission System** - 5-level hierarchy, 60+ granular permissions
- **Organization-Level Access Control** - Workspace isolation, membership verification
- **Clerk Integration** - Authentication, organization sync, RBAC support

### ❌ NOT IMPLEMENTED

- **Document Storage Schema** - No `documents` table
- **File Upload/Storage** - No Convex file storage or S3 integration
- **Per-Document Permissions** - No `document_access` table
- **Document Sharing Modes** - Private/team/specific-members/external
- **Sharing Audit Trail** - No activity logs for sharing events

---

## Critical Files & Locations

### Permission System (THE FOUNDATION)

**File**: `/apps/backend/convex/auth.utils.ts`

- `ROLE_HIERARCHY` - 5 roles: system (150) > owner (100) > admin (75) > member (50) > viewer (25)
- `ROLE_PERMISSIONS` - Permission definitions per role
- `DOCUMENT_SIGNING_PERMISSIONS` - 60+ named permissions
- `hasPermission()`, `hasRole()`, `canManageDocuments()` - Helper functions

### Schemas

```
/apps/backend/convex/schemas/
├── organizations.ts              # Workspace definition
├── organization_members.ts       # Membership + roles
├── organization_invitations.ts   # Invitation workflow
└── users.ts                      # User accounts
```

### API Patterns (COPY THESE)

```
/apps/backend/convex/organizations/
├── queries.ts                    # Reference: getOrganization, getOrganizationMembers
└── mutations.ts                  # Reference: createWorkspace, addMember, updateMemberRole
```

### Design Specifications

```
/docs/features/workspace-management/team-collaboration/
├── wireframes/02-document-sharing.md   # Complete UI specs
└── feature-spec.md                      # Requirements
```

---

## Key Data Models

### Organizations Table

```typescript
{
  _id: Id,
  name: string,
  slug: string (indexed),
  type: "personal" | "group" | "company",
  isActive: boolean,
  timezone: string,
  clerkId?: string,
  // 4 indexes for fast lookups
}
```

### Organization Members Table

```typescript
{
  _id: Id,
  userId: Id<"users">,
  organizationId: Id<"organizations">,

  role: "system" | "owner" | "admin" | "member" | "viewer",
  permissions?: string[],           // Individual overrides
  status: "active" | "inactive" | "suspended" | "pending" | "blocked",
  isPrimary: boolean,

  // 6 indexes for efficient queries
}
```

---

## What You Need to Create

### 1. Documents Table (New)

```typescript
{
  organizationId: Id<"organizations">,  // Workspace scoping
  ownerId: Id<"users">,                 // Creator
  name: string,
  fileSize: number,
  fileType: string,

  // File storage reference
  storageId?: string,                   // Convex files
  // OR
  fileUrl?: string,                     // External URL

  // Sharing mode
  sharingMode: "private" | "workspace" | "specific" | "external",

  status: "draft" | "ready" | "archived" | "deleted",

  createdAt: number,
  updatedAt: number,
}

// Indexes needed:
// - by_organization (list org docs)
// - by_owner (list user's docs)
// - by_status (filter active docs)
// - by_sharing_mode (filter by share type)
```

### 2. Document Access Table (New)

```typescript
{
  documentId: Id<"documents">,
  userId: Id<"users">,

  permissionLevel: "view" | "edit" | "manage",

  grantedBy: Id<"users">,
  grantedAt: number,
}

// Indexes needed:
// - by_document (who can access)
// - by_user (user's accessible docs)
// - by_document_user (specific access check)
```

---

## Implementation Pattern (from existing code)

### Query Access Control

```typescript
export const getDocument = authQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    // 1. Get document
    const doc = await ctx.db.get(args.documentId);
    if (!doc) throw new ConvexError("Document not found");

    // 2. Check user has access to organization
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", doc.organizationId),
      )
      .first();

    if (!member) throw new ConvexError("No access to this organization");

    // 3. Check document-level permissions
    if (doc.sharingMode === "private" && doc.ownerId !== ctx.auth.user._id) {
      throw new ConvexError("No access to this document");
    }

    if (doc.sharingMode === "specific") {
      const access = await ctx.db
        .query("document_access")
        .withIndex("by_document_user", (q) =>
          q.eq("documentId", doc._id).eq("userId", ctx.auth.user._id),
        )
        .first();

      if (!access) throw new ConvexError("No access to this document");
    }

    // 4. Safe to return
    return doc;
  },
});
```

### Permission Checks

```typescript
// In handler: check if user can edit
if (!hasPermission(member, "documents:update")) {
  throw new ConvexError("Insufficient permissions");
}

// Check document-level edit access
if (doc.sharingMode === "specific") {
  const access = await ctx.db
    .query("document_access")
    .withIndex("by_document_user", (q) => q.eq("documentId", docId).eq("userId", ctx.auth.user._id))
    .first();

  if (!access || access.permissionLevel === "view") {
    throw new ConvexError("No edit access");
  }
}
```

---

## Permission Checks Available (Ready to Use)

```typescript
// From auth.utils.ts - use these functions
hasPermission(member, "documents:read");
hasPermission(member, "documents:create");
hasPermission(member, "documents:update");
hasPermission(member, "documents:delete");
hasPermission(member, "documents:send");
hasPermission(member, "documents:download");

canManageDocuments(member, orgId); // Create/update/delete
canSendDocuments(member); // Send for signing
canDownloadDocuments(member); // Download
canAccessOrganization(member, orgId); // Workspace check
hasRole(member, "admin"); // Role hierarchy
```

---

## Free Plan Restriction Rules

Based on design specs:

- **Free Plan**: External sharing via email ONLY (no team sharing)
- **Pro Plan**: All sharing modes enabled (private, team, specific, external)

Implementation:

```typescript
// Check plan before allowing team sharing
const subscription = await ctx.db
  .query("subscriptions")
  .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
  .first();

const isPro = subscription?.status === "active";

if (!isPro && sharingMode !== "private" && sharingMode !== "external") {
  throw new ConvexError("Team sharing requires Pro plan");
}
```

---

## Complete Implementation Checklist

- [ ] Create `documents` table schema with proper indexes
- [ ] Create `document_access` table for specific sharing
- [ ] Implement document query handlers (get, list, search)
- [ ] Implement document mutation handlers (create, update, delete)
- [ ] Add permission checks to document queries/mutations
- [ ] Implement sharing mode change logic
- [ ] Implement permission level change logic
- [ ] Implement ownership transfer logic
- [ ] Add free plan restrictions
- [ ] Create notification system (Resend) for sharing events
- [ ] Add activity/audit logging for sharing
- [ ] Implement real-time updates (Convex subscriptions)
- [ ] Build document library filtering UI
- [ ] Build sharing modal UI
- [ ] Build permission management UI

---

## Key Success Indicators

When complete:

- Users can create private documents
- Users can share documents with entire team
- Users can share documents with specific members
- Different permission levels work (view/edit/manage)
- Document ownership can be transferred
- Free plan users cannot do team sharing
- Pro plan users have all sharing modes
- Activity logs track all sharing changes
