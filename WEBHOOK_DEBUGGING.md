# Webhook Debugging Guide

## Issue: Invitation visible in Clerk but not saving to Convex

### What I've Done

1. **Added Enhanced Logging** to `http.ts`:
   - Now logs full webhook payload
   - Logs success/failure of mutation
   - Logs missing data warnings

2. **Started Log Watching**:
   ```bash
   npx convex logs --watch
   ```

### What to Check Now

**Send another invitation and watch for these logs:**

#### Expected Flow:

```
1. [Clerk Webhook] Received: organizationInvitation.created
2. [Clerk Webhook] Processing invitation.created
   - Shows full data payload
3. [Clerk Webhook] Invitation created successfully
   OR
3. [Clerk Webhook] Error handling invitation.created
```

### Possible Issues:

#### 1. **Missing Organization Data**
```
⚠️ Organization with Clerk ID {id} not found
```
**Solution**: Organization in Convex needs matching `clerkId`

#### 2. **Missing Inviter**
```
⚠️ No owner/admin found for organization
```
**Solution**: Ensure at least one admin/owner exists in organization

#### 3. **Webhook Payload Issues**
If you see:
```
Missing required data for invitation.created
```
Check the payload structure in Clerk Dashboard

### Debugging Steps:

1. **Check Clerk Webhook Logs**:
   - Go to Clerk Dashboard → Webhooks
   - Click on your endpoint
   - View "Recent Deliveries"
   - Check HTTP status (should be 200)

2. **Verify Organization Sync**:
   ```bash
   npx convex dashboard
   # Check organizations table
   # Verify clerkId field matches Clerk org ID
   ```

3. **Check for Inviter**:
   ```bash
   npx convex dashboard
   # Check organization_members table
   # Ensure at least one member with role="owner" or "admin"
   ```

### Quick Test:

Run this to see current invitation records:

```bash
npx convex dashboard
# Navigate to: organization_invitations table
# Check if any records exist with clerkInvitationId
```

### What the Enhanced Logging Will Show:

The new logs will show the EXACT webhook payload from Clerk, which will tell us:
- Is `data.organization.id` present?
- Is `data.email_address` present?
- What is the full structure of the data?
- Any errors during mutation?

**Please send another invitation now and share the logs!**
