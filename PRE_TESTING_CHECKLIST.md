# Pre-Testing Checklist - Clerk Invitation System

## ✅ Before You Start Testing

### 1. Environment Variables ✓

**Backend** (`apps/backend/.env`):
```bash
# Already added
CLERK_SECRET_KEY=sk_test_...

# Verify these exist
CLERK_WEBHOOK_SECRET=whsec_...
CONVEX_DEPLOYMENT=...
```

**Check**:
```bash
cd apps/backend
cat .env | grep CLERK_SECRET_KEY
cat .env | grep CLERK_WEBHOOK_SECRET
```

---

### 2. Clerk Dashboard Configuration

#### A. Enable Organization Invitations
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Organizations** (left sidebar)
4. Enable **"Organization Invitations"** feature
5. Verify settings:
   - ✅ Invitations enabled
   - ✅ Expiration: 30 days (default)

#### B. Configure Webhooks
1. Go to **Webhooks** (left sidebar)
2. Click **"Add Endpoint"**
3. Configure endpoint:
   - **Endpoint URL**: Get from Convex (see below)
   - **Events to listen for**: Select these 3 events:
     - ✅ `organizationInvitation.created`
     - ✅ `organizationInvitation.accepted`
     - ✅ `organizationInvitation.revoked`
4. Save endpoint
5. **Important**: Copy the webhook secret
6. Verify it matches `CLERK_WEBHOOK_SECRET` in your `.env`

**Get your Convex webhook URL**:
```bash
cd apps/backend
npx convex dev

# Look for output like:
# └─ HTTP Actions: https://your-deployment.convex.site
```

Your webhook URL will be: `https://your-deployment.convex.site/clerk-webhooks`

---

### 3. Verify Organization Setup

**Check your organization has a Clerk ID**:

1. Start Convex dashboard:
```bash
cd apps/backend
npx convex dashboard
```

2. Navigate to **organizations** table
3. Find your current organization
4. Verify `clerkId` field is populated (looks like `org_xxxxx`)

**If `clerkId` is empty**:
- This means the organization was created before Clerk sync
- You need to either:
  1. Create a new organization via Clerk (recommended for testing)
  2. Or sync the existing organization with Clerk

---

### 4. Test Convex Connection

```bash
cd apps/backend
npx convex dev --once
```

**Expected output**:
```
✔ Convex functions ready!
```

**If you see errors**:
- Check `CONVEX_DEPLOYMENT` in `.env`
- Run `npx convex login` if needed
- Verify internet connection

---

### 5. Verify Code Build

```bash
# From project root
cd apps/web
npm run build

# Should complete without errors
```

---

## 📋 Quick Verification Commands

Run these to verify everything is set up:

```bash
# 1. Check environment variables
cd apps/backend
echo "Checking CLERK_SECRET_KEY..."
cat .env | grep CLERK_SECRET_KEY
echo "Checking CLERK_WEBHOOK_SECRET..."
cat .env | grep CLERK_WEBHOOK_SECRET

# 2. Verify Convex is working
echo "Testing Convex connection..."
npx convex dev --once

# 3. Check if actions are registered
npx convex dashboard
# Navigate to Functions → organizations/actions
# Should see: clerkInvite, clerkRevokeInvitation, getInvitationEmailByClerkId
```

---

## 🎯 Ready to Test?

### Prerequisites Checklist

Before testing, ensure all these are checked:

- [ ] `CLERK_SECRET_KEY` added to `apps/backend/.env`
- [ ] `CLERK_WEBHOOK_SECRET` exists in `apps/backend/.env`
- [ ] Organization invitations enabled in Clerk Dashboard
- [ ] Webhook endpoint configured in Clerk Dashboard
- [ ] Webhook events selected (created, accepted, revoked)
- [ ] At least one organization has `clerkId` populated
- [ ] Convex is running without errors (`npx convex dev`)
- [ ] Code builds successfully

---

## 🚀 Start Testing

Once all checkboxes are ticked:

1. **Start development servers**:
```bash
# Terminal 1: Backend
cd apps/backend
npx convex dev

# Terminal 2: Frontend
cd apps/web
npm run dev
```

2. **Open application**:
```
http://localhost:3000
```

3. **Log in as admin/owner**

4. **Navigate to Team Settings**:
```
Settings → Team
```

5. **Send test invitation**:
   - Click "Invite Member"
   - Enter your test email
   - Select role (e.g., "Member")
   - Click "Send Invitation"

---

## 🔍 What to Watch For

### Success Indicators:

1. **Frontend**:
   - ✅ Success toast: "Invitation sent"
   - ✅ Dialog closes
   - ✅ No errors in browser console

2. **Convex Logs** (Terminal 1):
   ```
   ✅ [Clerk Webhook] Invitation created: test@example.com -> org_xyz
   ✅ Created invitation record: test@example.com -> Organization Name
   ```

3. **Email**:
   - ✅ Email received within seconds
   - ✅ Professional Clerk branding
   - ✅ Invitation link present

4. **Database**:
   - Open Convex dashboard
   - Check `organization_invitations` table
   - ✅ New record with `clerkInvitationId`
   - ✅ Status: "pending"

---

## ⚠️ Common Issues & Solutions

### Issue: "CLERK_SECRET_KEY environment variable is not set"
**Solution**:
- Verify `.env` file location: `apps/backend/.env`
- Restart `npx convex dev` after adding the key
- Check for typos in the key

### Issue: Webhook not received
**Solution**:
- Verify webhook URL in Clerk Dashboard
- Check Clerk Dashboard → Webhooks → Recent Deliveries
- Ensure events are selected
- Try "Send Test Event" in Clerk

### Issue: "Organization not synced with Clerk"
**Solution**:
- Organization needs `clerkId` field
- Create organization through Clerk
- Or manually add `clerkId` from Clerk Dashboard

### Issue: Email not received
**Solution**:
- Check spam/junk folder
- Verify email address is correct
- Check Clerk Dashboard → Emails → Logs
- Ensure email provider (Clerk) is configured

---

## 📊 Testing Flow

```
1. Send Invitation
   ↓
2. Clerk API call (clerkInvite)
   ↓
3. Clerk sends email
   ↓
4. Clerk webhook → Convex (invitation.created)
   ↓
5. Database: invitation stored
   ↓
6. User receives email
   ↓
7. User clicks link
   ↓
8. Redirect to /accept-invite
   ↓
9. Redirect to Clerk signup
   ↓
10. User completes signup
    ↓
11. Clerk webhook → Convex (invitation.accepted)
    ↓
12. Database: membership created
    ↓
13. User is now a member! ✅
```

---

## 📞 Need Help?

If something doesn't work:

1. **Check Convex Logs**:
   ```bash
   npx convex logs --watch
   ```

2. **Check Clerk Webhook Logs**:
   - Clerk Dashboard → Webhooks
   - Click on your endpoint
   - View "Recent Deliveries"

3. **Check Browser Console**:
   - Open DevTools (F12)
   - Look for errors

4. **Review Documentation**:
   - `CLERK_INVITATION_IMPLEMENTATION.md` - Full technical guide
   - `INVITATION_SETUP_GUIDE.md` - Setup instructions

---

## ✅ All Set!

If all items in the **Prerequisites Checklist** are checked, you're ready to test!

**Next**: Follow the testing steps in `INVITATION_SETUP_GUIDE.md`

Good luck! 🚀
