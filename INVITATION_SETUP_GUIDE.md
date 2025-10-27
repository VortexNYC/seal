# Quick Setup Guide - Clerk Invitation System

## 🚀 Immediate Next Steps

### 1. Verify Environment Variables

Check `apps/backend/.env`:

```bash
# Required for Clerk Backend API
CLERK_SECRET_KEY=sk_test_...

# Should already exist
CLERK_WEBHOOK_SECRET=whsec_...
```

**Get your CLERK_SECRET_KEY**:
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Go to "API Keys"
4. Copy "Secret Key"
5. Add to `.env` file

---

### 2. Configure Clerk Webhooks

**Add webhook endpoint**:
1. Go to Clerk Dashboard → Webhooks
2. Click "Add Endpoint"
3. Enter endpoint URL:
   - **Development**: `https://your-convex-url.convex.site/clerk-webhooks`
   - Get from `npx convex dev` output
4. Select events:
   - ✅ `organizationInvitation.created`
   - ✅ `organizationInvitation.accepted`
   - ✅ `organizationInvitation.revoked`
5. Save webhook
6. Copy webhook secret and verify it matches `CLERK_WEBHOOK_SECRET`

---

### 3. Enable Organization Invitations in Clerk

1. Go to Clerk Dashboard → Organizations
2. Enable "Organization Invitations" feature
3. Configure settings:
   - Invitation expiration: 30 days (default)
   - Email template: Customize if needed

---

### 4. Test the Flow

**Step 1: Send Invitation**
```bash
# Start development
npx convex dev
cd apps/web && npm run dev
```

1. Log in as admin/owner
2. Go to Settings → Team
3. Click "Invite Member"
4. Enter test email
5. Select role
6. Click "Send Invitation"

**Step 2: Check Logs**
```bash
# Watch Convex logs
npx convex logs --watch

# Look for:
# ✅ [Clerk Webhook] Invitation created: test@example.com -> org_xyz
# ✅ Created invitation record: test@example.com -> Organization Name
```

**Step 3: Accept Invitation**
1. Check email inbox
2. Click invitation link
3. Verify redirect to signup
4. Complete signup
5. Verify access to organization

**Step 4: Verify in Database**
```bash
# Open Convex dashboard
npx convex dashboard
```

Check tables:
- `organization_invitations` - should have record with `clerkInvitationId`
- `organization_members` - should have new member after acceptance

---

## 🔧 Troubleshooting

### Invitation email not sent?

**Check**:
1. Convex logs: `npx convex logs`
2. Look for errors in `clerkInvite` action
3. Verify `CLERK_SECRET_KEY` is set
4. Check Clerk API status

**Debug**:
```typescript
// In browser console, test the action directly:
const result = await api.organizations.actions.clerkInvite({
  email: "test@example.com",
  role: "member",
  organizationId: "your-org-id"
});
console.log(result); // Should show { ok: true, message: "..." }
```

---

### Webhook not working?

**Check**:
1. Clerk Dashboard → Webhooks → View logs
2. Verify endpoint URL is correct
3. Verify events are selected
4. Check HTTP status codes (should be 200)

**Test webhook manually**:
```bash
# In Clerk Dashboard, click "Send Test Event"
# Watch Convex logs for processing
```

---

### User not added to organization?

**Check**:
1. Convex logs for `handleInvitationAccepted`
2. Verify user record exists in `users` table
3. Check for retry attempts (up to 3)
4. Verify organization has `clerkId` field populated

---

## 📝 Testing Checklist

Use this for your first test:

- [ ] Environment variables configured
- [ ] Webhook endpoint added in Clerk
- [ ] Webhook events selected
- [ ] Organization invitations enabled
- [ ] `npx convex dev` running
- [ ] Frontend dev server running
- [ ] Admin user logged in
- [ ] Test invitation sent
- [ ] Email received
- [ ] Invitation link works
- [ ] Signup flow completes
- [ ] User added to organization
- [ ] Correct role assigned
- [ ] Database records created
- [ ] Revocation tested

---

## 🎯 Key Files Reference

### Backend
- `apps/backend/convex/organizations/actions.ts` - Clerk API calls
- `apps/backend/convex/webhooks.ts` - Webhook handlers
- `apps/backend/convex/http.ts` - HTTP routes
- `apps/backend/convex/schemas/organization_invitations.ts` - Schema

### Frontend
- `apps/web/src/routes/_auth/accept-invite.tsx` - Accept route
- `apps/web/src/components/team/invite-member-dialog.tsx` - UI component

---

## 🔍 Debugging Commands

```bash
# Watch Convex logs
npx convex logs --watch

# Check specific table
npx convex query organization_invitations:list

# Check webhook status
curl https://your-convex-url.convex.site/clerk-webhooks

# Test Clerk API connection
# (in Convex dashboard or via action)
```

---

## 📚 Documentation

- Full implementation details: `CLERK_INVITATION_IMPLEMENTATION.md`
- Clerk Docs: https://clerk.com/docs/organizations/invitations
- Convex Docs: https://docs.convex.dev/

---

## ✅ Success Indicators

You'll know it's working when:
1. ✅ No errors in Convex logs
2. ✅ Invitation email arrives within seconds
3. ✅ Email has professional Clerk branding
4. ✅ Invitation link redirects to signup
5. ✅ Email is prefilled in signup form
6. ✅ After signup, user lands in organization
7. ✅ User has correct role/permissions
8. ✅ Invitation shows as "accepted" in database

---

## 🚨 Common Gotchas

1. **Organizations must have `clerkId`**:
   - Only Clerk-synced organizations can use invitations
   - Personal orgs without Clerk are not supported

2. **Webhook ordering**:
   - Invitation created webhook may arrive before user webhook
   - System has retry logic to handle this

3. **Email delays**:
   - Clerk emails are usually instant
   - Check spam folder if delayed

4. **Development vs Production**:
   - Use different webhook endpoints
   - Update environment variables accordingly

---

**Ready to Test?** Follow steps 1-4 above, then proceed with testing checklist!
