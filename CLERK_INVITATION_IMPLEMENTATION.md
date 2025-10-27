# Clerk Invitation System Implementation

## Overview

This document describes the complete Clerk-based invitation system that has been implemented in the Seal project, matching the working implementation in catapult-vite.

## ✅ Completed Implementation

### 1. Package Installation
- **Package**: `@clerk/backend@2.19.0`
- **Location**: `apps/backend/package.json`
- **Purpose**: Enables Clerk Backend API calls for creating and managing invitations

### 2. Database Schema Updates
**File**: `apps/backend/convex/schemas/organization_invitations.ts`

Added Clerk-specific fields:
```typescript
clerkInvitationId: v.optional(v.string())      // Clerk's invitation ID
clerkOrganizationId: v.optional(v.string())    // Clerk's organization ID
roleId: v.optional(v.id("organization_roles")) // Custom role reference
```

Added index:
```typescript
.index("by_clerk_invitation_id", ["clerkInvitationId"])
```

### 3. Clerk Actions (Backend API Integration)
**File**: `apps/backend/convex/organizations/actions.ts` (NEW)

Three key actions:

#### `clerkInvite`
- Creates organization invitation via Clerk Backend API
- Automatically sends email to invitee
- Stores role in publicMetadata
- Returns `{ ok: boolean, message: string }`

#### `clerkRevokeInvitation`
- Revokes pending invitations in Clerk
- Triggers webhook to update database
- Returns `{ ok: boolean, message: string }`

#### `getInvitationEmailByClerkId`
- Fetches invitation email from Clerk API
- Used by accept-invite route to prefill email
- Returns `{ email: string | null }`

### 4. Webhook Handlers
**File**: `apps/backend/convex/webhooks.ts`

Added three internal mutations:

#### `handleInvitationCreated`
- Triggered when Clerk creates invitation
- Stores invitation in database with status "pending"
- Extracts role from publicMetadata
- Sets 30-day expiration

#### `handleInvitationAccepted`
- Triggered when user accepts invitation
- Creates organization membership with invited role
- Includes retry logic (3 attempts, 2-second delays)
- Updates invitation status to "accepted"

#### `handleInvitationRevoked`
- Triggered when invitation is revoked
- Deletes invitation from database

### 5. HTTP Webhook Routes
**File**: `apps/backend/convex/http.ts`

Updated ClerkWebhookEvent interface to include:
```typescript
| "organizationInvitation.created"
| "organizationInvitation.accepted"
| "organizationInvitation.revoked"
```

Added webhook handlers:
- `organizationInvitation.created` → calls `handleInvitationCreated`
- `organizationInvitation.accepted` → calls `handleInvitationAccepted`
- `organizationInvitation.revoked` → calls `handleInvitationRevoked`

### 6. Accept Invite Route (Frontend)
**File**: `apps/web/src/routes/_auth/accept-invite.tsx` (NEW)

Public route that:
1. Extracts `__clerk_ticket` from URL parameters
2. Decodes JWT to get invitation ID
3. Fetches email from backend
4. Redirects to Clerk signup with prefilled email
5. Handles errors with user-friendly messages

### 7. Updated UI Component
**File**: `apps/web/src/components/team/invite-member-dialog.tsx`

Changes:
- Switched from `useMutation` to `useAction`
- Now calls `clerkInvite` action instead of `createInvitation` mutation
- Updated success message to indicate email delivery
- Passes organizationId to the action

---

## How It Works

### Invitation Flow

1. **Admin sends invitation**:
   - Opens InviteMemberDialog
   - Enters email and selects role
   - Clicks "Send Invitation"
   - Frontend calls `clerkInvite` action

2. **Backend creates invitation**:
   - `clerkInvite` action calls Clerk Backend API
   - Clerk sends invitation email automatically
   - Email contains secure link with `__clerk_ticket` parameter

3. **Webhook syncs invitation**:
   - Clerk sends `organizationInvitation.created` webhook
   - `handleInvitationCreated` stores invitation in database
   - Status set to "pending"

4. **User receives email**:
   - Email from Clerk with invitation link
   - Link format: `https://yourapp.com/accept-invite?__clerk_ticket=...`

5. **User clicks invitation link**:
   - Redirects to `/accept-invite` route
   - Route decodes ticket and fetches email
   - Builds Clerk signup URL with prefilled email
   - Redirects to Clerk hosted signup

6. **User completes signup**:
   - Signs up via Clerk
   - Clerk sends `organizationInvitation.accepted` webhook

7. **Webhook creates membership**:
   - `handleInvitationAccepted` creates organization_members record
   - Role from invitation is applied
   - Invitation status updated to "accepted"
   - User is now a member of the organization

### Revocation Flow

1. **Admin revokes invitation**:
   - Clicks revoke button in pending invitations list
   - Frontend calls `clerkRevokeInvitation` action

2. **Backend revokes invitation**:
   - Action calls Clerk Backend API to revoke
   - Clerk sends `organizationInvitation.revoked` webhook

3. **Webhook removes invitation**:
   - `handleInvitationRevoked` deletes invitation from database
   - Invitation link no longer works

---

## Configuration Required

### Environment Variables

Ensure these are set in your `.env` file:

```bash
# Backend (apps/backend/.env)
CLERK_SECRET_KEY=sk_test_... # For Clerk Backend API calls

# Already configured (just verify)
CLERK_WEBHOOK_SECRET=whsec_... # For webhook verification
```

### Clerk Dashboard Configuration

1. **Enable Organization Invitations**:
   - Go to Clerk Dashboard → Organizations
   - Enable "Organization Invitations"

2. **Configure Webhook Events**:
   - Go to Webhooks
   - Add your webhook endpoint: `https://yourapp.com/clerk-webhooks`
   - Select events:
     - `organizationInvitation.created`
     - `organizationInvitation.accepted`
     - `organizationInvitation.revoked`

3. **Email Templates** (Optional):
   - Customize invitation email template in Clerk Dashboard
   - Update branding and copy

---

## API Reference

### Backend Actions

#### `clerkInvite`
```typescript
api.organizations.actions.clerkInvite({
  email: string,
  role: "admin" | "member" | "viewer",
  organizationId: Id<"organizations">
}) => Promise<{ ok: boolean, message: string }>
```

#### `clerkRevokeInvitation`
```typescript
api.organizations.actions.clerkRevokeInvitation({
  clerkInvitationId: string,
  clerkOrganizationId: string
}) => Promise<{ ok: boolean, message: string }>
```

#### `getInvitationEmailByClerkId`
```typescript
api.organizations.actions.getInvitationEmailByClerkId({
  clerkInvitationId: string
}) => Promise<{ email: string | null }>
```

### Webhook Mutations (Internal)

#### `handleInvitationCreated`
```typescript
internal.webhooks.handleInvitationCreated({
  clerkInvitationId: string,
  clerkOrganizationId: string,
  emailAddress: string,
  role?: string,
  publicMetadata?: any,
  createdAt?: number
}) => Promise<{ created: boolean, _id?: Id<"organization_invitations"> }>
```

#### `handleInvitationAccepted`
```typescript
internal.webhooks.handleInvitationAccepted({
  clerkInvitationId: string,
  clerkOrganizationId: string,
  clerkUserId?: string,
  retryCount?: number
}) => Promise<{ accepted: boolean, _id?: Id<"organization_members"> }>
```

#### `handleInvitationRevoked`
```typescript
internal.webhooks.handleInvitationRevoked({
  clerkInvitationId: string
}) => Promise<{ revoked: boolean, _id?: Id<"organization_invitations"> }>
```

---

## Testing Checklist

### Manual Testing Steps

1. **Send Invitation**:
   - [ ] Log in as admin/owner
   - [ ] Navigate to Team Settings
   - [ ] Click "Invite Member"
   - [ ] Enter email and select role
   - [ ] Click "Send Invitation"
   - [ ] Verify success toast appears
   - [ ] Check email inbox for invitation email

2. **Verify Database**:
   - [ ] Check Convex dashboard
   - [ ] Verify `organization_invitations` table has new record
   - [ ] Verify `clerkInvitationId` is populated
   - [ ] Verify status is "pending"

3. **Accept Invitation**:
   - [ ] Click invitation link in email
   - [ ] Verify redirect to `/accept-invite`
   - [ ] Verify redirect to Clerk signup
   - [ ] Verify email is prefilled
   - [ ] Complete signup
   - [ ] Verify redirect to dashboard

4. **Verify Membership**:
   - [ ] Check Convex dashboard
   - [ ] Verify `organization_members` table has new record
   - [ ] Verify correct role is assigned
   - [ ] Verify invitation status is "accepted"
   - [ ] Log in as new user
   - [ ] Verify access to organization

5. **Revoke Invitation**:
   - [ ] Send another invitation
   - [ ] Click revoke in pending invitations list
   - [ ] Verify invitation is removed from list
   - [ ] Verify invitation link no longer works
   - [ ] Verify database record is deleted

### Edge Cases to Test

- [ ] Inviting existing user with account
- [ ] Inviting user twice (should error)
- [ ] Expired invitation (30 days)
- [ ] Invalid invitation link
- [ ] Network failures during invitation
- [ ] Webhook ordering issues (retry logic)

---

## Troubleshooting

### Issue: "CLERK_SECRET_KEY environment variable is not set"
**Solution**: Add `CLERK_SECRET_KEY` to `apps/backend/.env`

### Issue: Invitation email not received
**Possible causes**:
1. Clerk API error - check Convex logs
2. Email spam folder - check spam
3. Invalid email address - verify email format

### Issue: Invitation link doesn't work
**Possible causes**:
1. Invitation expired (30 days)
2. Invitation revoked
3. Webhook not processed - check Convex logs
4. Route not registered - verify `/accept-invite` route exists

### Issue: User not added to organization
**Possible causes**:
1. Webhook not received - check Clerk Dashboard webhook logs
2. Organization not synced with Clerk - verify `clerkId` exists
3. Race condition - check retry logic in `handleInvitationAccepted`

### Issue: Wrong role assigned
**Possible causes**:
1. publicMetadata not passed correctly
2. Role mapping issue in webhook handler
3. Check role value in `clerkInvite` action

---

## Comparison with Previous System

| Feature | Old System | New System (Clerk) |
|---------|-----------|-------------------|
| Email delivery | Manual (not implemented) | Automatic via Clerk |
| Invitation links | UUID tokens | Clerk JWT tickets |
| Email template | N/A | Customizable in Clerk |
| Expiration | 7 days | 30 days (Clerk default) |
| Security | Basic token | Clerk-signed JWT |
| Status sync | Manual | Automatic via webhooks |
| Accept flow | Not implemented | Full flow via `/accept-invite` |
| Revocation | Database only | Clerk API + webhooks |

---

## Migration Notes

### For Existing Invitations

The system supports both old and new invitation methods:
- Old invitations (manual tokens) continue to work
- New invitations use Clerk system
- Both stored in same `organization_invitations` table
- Identified by presence of `clerkInvitationId`

### Cleanup Old Invitations

If you want to remove old manual invitations:

```typescript
// Query invitations without Clerk ID
const oldInvitations = await ctx.db
  .query("organization_invitations")
  .filter((q) => q.eq(q.field("clerkInvitationId"), undefined))
  .collect();

// Delete or migrate as needed
```

---

## Next Steps

1. **Test in development environment**
2. **Configure Clerk webhook endpoint**
3. **Customize email templates in Clerk**
4. **Update documentation for users**
5. **Deploy to staging**
6. **Test end-to-end flow**
7. **Deploy to production**

---

## Support

For issues or questions:
- Check Convex logs: `npx convex logs`
- Check Clerk webhook logs: Clerk Dashboard → Webhooks
- Review this documentation
- Check catapult-vite implementation for reference

---

**Implementation Date**: 2025-10-27
**Status**: ✅ Complete and Ready for Testing
