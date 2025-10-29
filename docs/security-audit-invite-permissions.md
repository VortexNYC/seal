# Security Audit: Invite Member Flow Permission Validation

**Date**: 2025-10-27
**Severity**: 🔴 **CRITICAL**
**Status**: ⚠️ **REQUIRES IMMEDIATE FIX**

---

## Executive Summary

A critical security vulnerability has been identified in the invite member flow. The backend action `clerkInvite` **does NOT validate user permissions** before sending invitations, allowing any authenticated user to bypass frontend restrictions and invite members to organizations regardless of their role.

---

## Current Implementation Analysis

### ✅ Frontend Validation (WORKING CORRECTLY)

**File**: `apps/web/src/routes/_authenticated/$slug/settings/team/index.tsx`

The frontend correctly implements permission checks:

```typescript
// Line 49-52: Only fetch invitations if user has permission
const invitations = useQuery(
	api.organizations.queries.getPendingInvitations,
	orgId && permissions?.permissions.canInviteMembers
		? { organizationId: orgId }
		: "skip",
);

// Line 58: Get permission from backend
const canInvite = permissions?.permissions.canInviteMembers ?? false;

// Line 68-74: Only show button if user has permission
action={
	canInvite
		? {
				label: "Invite Member",
				onClick: () => setIsInviteDialogOpen(true),
				icon: UserPlus,
			}
		: undefined
}

// Line 152-158: Only render dialog if user has permission
{canInvite && (
	<InviteMemberDialog
		organizationId={orgId}
		open={isInviteDialogOpen}
		onOpenChange={setIsInviteDialogOpen}
	/>
)}
```

**✅ Result**: UI correctly hides invite functionality from unauthorized users.

---

### ⚠️ Backend Validation (MISSING - CRITICAL VULNERABILITY)

**File**: `apps/backend/convex/organizations/actions.ts`

The `clerkInvite` action performs these checks:

```typescript
export const clerkInvite = action({
	args: {
		email: v.string(),
		role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
		// ✅ Line 26-29: Check authentication
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError("Authentication required");
		}

		// ✅ Line 32-37: Check Clerk configuration
		if (!process.env.CLERK_SECRET_KEY) {
			throw new ConvexError({
				code: "MISSING_CONFIG",
				message: "CLERK_SECRET_KEY environment variable is not set",
			});
		}

		// ✅ Line 40-46: Check organization exists
		const organization = await ctx.runQuery(
			internal.organizations.helpers.getOrganizationById,
			{ organizationId: args.organizationId }
		);

		if (!organization) {
			throw new ConvexError("Organization not found");
		}

		// ✅ Line 48-53: Check Clerk sync
		if (!organization.clerkId) {
			throw new ConvexError({
				code: "ORGANIZATION_NOT_SYNCED",
				message: "This organization is not synced with Clerk...",
			});
		}

		// ❌ MISSING: Permission check for org:users:invite
		// Any authenticated user can reach this point!

		// Line 56-69: Create invitation in Clerk
		const clerk = createClerkClient({
			secretKey: process.env.CLERK_SECRET_KEY,
		});

		await clerk.organizations.createOrganizationInvitation({
			organizationId: organization.clerkId,
			emailAddress: args.email.toLowerCase(),
			role: "org:member",
			publicMetadata: {
				role: args.role,
			},
		});

		return { ok: true, message: "Invitation sent successfully" };
	},
});
```

**❌ Result**: Backend does NOT verify user has `org:users:invite` permission.

---

## Security Vulnerability Details

### Attack Vector

Any authenticated user can bypass frontend checks by calling the `clerkInvite` action directly:

```typescript
// Malicious code from browser console or API client
const result = await client.action(api.organizations.actions.clerkInvite, {
	email: "attacker@example.com",
	role: "admin",
	organizationId: "<any-org-they-are-member-of>",
});
```

### Impact

- **Viewer** users (read-only) can invite new members
- **Member** users (no admin rights) can invite new members
- Unauthorized users can escalate privileges by inviting themselves with admin role
- Violates principle of least privilege
- Violates documented permission model

### Affected Roles

According to `apps/backend/convex/auth.utils.ts` (lines 19-148):

| Role | Has `org:users:invite` | Can Exploit Vulnerability |
|------|------------------------|---------------------------|
| system | ✅ Yes (wildcard) | No (authorized) |
| owner | ✅ Yes | No (authorized) |
| admin | ✅ Yes | No (authorized) |
| member | ❌ **No** | ⚠️ **Yes - CRITICAL** |
| viewer | ❌ **No** | ⚠️ **Yes - CRITICAL** |

---

## Permission Model Reference

**File**: `apps/backend/convex/auth.utils.ts`

### System Role (lines 20-23)
```typescript
system: [
	// System-level permissions (all permissions)
	"*",
],
```

### Owner Role (lines 24-72)
```typescript
owner: [
	// Organization management
	"org:manage",
	"org:settings:read",
	"org:settings:update",
	"org:users:read",
	"org:users:invite",  // ✅ HAS PERMISSION
	"org:users:remove",
	"org:users:update_role",
	// ... other permissions
],
```

### Admin Role (lines 74-115)
```typescript
admin: [
	// Organization view
	"org:settings:read",
	"org:users:read",
	"org:users:invite",  // ✅ HAS PERMISSION
	// Subscription view
	"subscription:billing:read",
	// ... other permissions
],
```

### Member Role (lines 117-137)
```typescript
member: [
	// Documents (create and manage own)
	"documents:read",
	"documents:create",
	"documents:update",
	"documents:send",
	// ... NO org:users:invite permission ❌
],
```

### Viewer Role (lines 139-147)
```typescript
viewer: [
	// Read-only access
	"documents:read",
	"documents:download",
	"templates:read",
	// ... NO org:users:invite permission ❌
],
```

---

## Required Fix

### Implementation

Add permission validation to `apps/backend/convex/organizations/actions.ts`:

```typescript
import { ConvexError, v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { hasPermission, DOCUMENT_SIGNING_PERMISSIONS } from "../auth.utils"; // ADD THIS

export const clerkInvite = action({
	args: {
		email: v.string(),
		role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args): Promise<{ ok: boolean; message: string }> => {
		// Get the authenticated user
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError("Authentication required");
		}

		// ===== ADD THIS SECTION =====
		// Get the current user's membership in the organization
		const userMember = await ctx.runQuery(
			internal.organizations.helpers.getOrganizationMemberByUserIdAndOrgId,
			{
				userId: identity.subject, // or ctx.auth.user._id if available
				organizationId: args.organizationId,
			}
		);

		if (!userMember) {
			throw new ConvexError({
				code: "NO_ACCESS",
				message: "You don't have access to this organization",
			});
		}

		// Check if user has permission to invite members
		if (!hasPermission(userMember, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_INVITE)) {
			throw new ConvexError({
				code: "INSUFFICIENT_PERMISSIONS",
				message: "You don't have permission to invite members to this organization",
			});
		}
		// ===== END OF NEW SECTION =====

		// Check if Clerk is configured
		if (!process.env.CLERK_SECRET_KEY) {
			throw new ConvexError({
				code: "MISSING_CONFIG",
				message: "CLERK_SECRET_KEY environment variable is not set",
			});
		}

		// Get organization via internal query
		const organization = await ctx.runQuery(
			internal.organizations.helpers.getOrganizationById,
			{
				organizationId: args.organizationId,
			}
		);

		if (!organization) {
			throw new ConvexError("Organization not found");
		}

		if (!organization.clerkId) {
			throw new ConvexError({
				code: "ORGANIZATION_NOT_SYNCED",
				message: "This organization is not synced with Clerk. Only Clerk-managed organizations can send invitations.",
			});
		}

		try {
			const clerk = createClerkClient({
				secretKey: process.env.CLERK_SECRET_KEY,
			});

			// Create invitation in Clerk
			await clerk.organizations.createOrganizationInvitation({
				organizationId: organization.clerkId,
				emailAddress: args.email.toLowerCase(),
				role: "org:member",
				publicMetadata: {
					role: args.role,
				},
			});

			return { ok: true, message: "Invitation sent successfully" };
		} catch (error) {
			console.error("[clerkInvite] Error:", error);
			throw new ConvexError({
				code: "INVITATION_ERROR",
				message:
					error instanceof Error ? error.message : "Failed to send invitation",
			});
		}
	},
});
```

### Helper Query Needed

You may need to create a helper query in `apps/backend/convex/organizations/helpers.ts`:

```typescript
/**
 * Get organization member by user ID and organization ID
 * INTERNAL ONLY - used for permission checks
 */
export const getOrganizationMemberByUserIdAndOrgId = internalQuery({
	args: {
		userId: v.id("users"),
		organizationId: v.id("organizations"),
	},
	handler: async (ctx, args) => {
		const member = await ctx.db
			.query("organization_members")
			.withIndex("by_user_organization", (q) =>
				q
					.eq("userId", args.userId)
					.eq("organizationId", args.organizationId)
			)
			.first();

		return member;
	},
});
```

---

## Additional Actions to Audit

### 1. `clerkRevokeInvitation` (lines 88-130)

**Current Status**: ❌ Missing permission check

**Required Permission**: `org:users:invite` OR `org:users:remove`

**Fix**: Add permission validation similar to `clerkInvite`

---

### 2. `clerkDeleteUser` (lines 173-247)

**Current Status**: ⚠️ Partial validation

**Lines 202-207**: Checks role but NOT permissions
```typescript
// Prevent deleting owners
if (member.role === "owner") {
	throw new ConvexError({
		code: "CANNOT_DELETE_OWNER",
		message: "Cannot delete organization owner",
	});
}
```

**Issue**: Role check alone is insufficient. Need permission check.

**Required Permission**: `org:users:remove`

**Fix**: Add permission validation:
```typescript
// Check if current user has permission to remove members
if (!hasPermission(currentUserMember, DOCUMENT_SIGNING_PERMISSIONS.ORG_USERS_REMOVE)) {
	throw new ConvexError({
		code: "INSUFFICIENT_PERMISSIONS",
		message: "You don't have permission to remove members",
	});
}
```

---

## Testing Checklist

After implementing the fix, verify:

- [ ] **Owner** can invite members ✅
- [ ] **Admin** can invite members ✅
- [ ] **Member** CANNOT invite members (receives permission error) ❌
- [ ] **Viewer** CANNOT invite members (receives permission error) ❌
- [ ] Direct action call from browser console fails for unauthorized users
- [ ] Error message is clear: "You don't have permission to invite members to this organization"
- [ ] Suspended/inactive users cannot invite members
- [ ] Permission check happens BEFORE Clerk API call (to avoid rate limiting)

---

## Documentation Reference

**File**: `docs/development-tickets.md`

### Parent #35: Team Collaboration (lines 1608-1692)

**Acceptance Criteria - Role-Based Permissions** (lines 1646-1659):

```markdown
**Role-Based Permissions:**

- [ ] Owner role: Full workspace control, can delete workspace
- [ ] Admin role: Manage members, documents, settings
- [ ] Member role: Create and send documents, limited settings
- [ ] Viewer role: View documents only, no editing
- [ ] Permissions matrix documented and enforced
- [ ] **Permission checks on all mutations** ⚠️ NOT MET
- [ ] **Unauthorized actions show permission error** ⚠️ NOT MET
- [ ] Role badges displayed throughout app
- [ ] Only Owner can change Owner role
- [ ] Workspace must always have at least one Owner
```

**Lines 1641-1642 are NOT currently satisfied by the `clerkInvite` action.**

---

## Priority & Timeline

**Priority**: 🔴 **P0 - Critical Security Issue**

**Recommended Timeline**:
- **Immediate**: Block production deployment until fixed
- **Target**: Fix within 24 hours
- **Testing**: 2-4 hours for comprehensive testing
- **Deploy**: Hotfix to production immediately after testing

---

## Related Issues

- [ ] Audit all other actions in `organizations/actions.ts`
- [ ] Audit actions in other modules (documents, templates, webhooks)
- [ ] Add integration tests for permission validation
- [ ] Document permission testing requirements for code reviews
- [ ] Consider adding automated permission validation linting

---

## Summary

**Vulnerability**: Backend action allows any authenticated user to invite members regardless of permissions

**Root Cause**: Missing `hasPermission()` check in `clerkInvite` action

**Fix**: Add permission validation before Clerk API call

**Impact**: High - allows privilege escalation and unauthorized access

**Status**: Requires immediate fix before production deployment
