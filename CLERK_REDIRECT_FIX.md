# URGENT: Clerk Redirect Configuration Fix

## The Problem

When users accept an invitation and sign up, they're being redirected to `dashboard.clerk.com` instead of your application.

## Why This Happens

When you create invitations via Clerk's Backend API, Clerk sends emails with their own invitation flow. After signup, Clerk doesn't know where to redirect users back to YOUR application.

## The Fix - Configure Clerk Dashboard

### Step 1: Set Application URLs in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Go to **"Paths"** (in left sidebar under "User & Authentication")
4. Set these URLs:

```
Home URL: http://localhost:3000/app
(or your production URL: https://yourdomain.com/app)

Sign-in URL: http://localhost:3000/sign-in
Sign-up URL: http://localhost:3000/sign-up
```

### Step 2: Set Redirect URLs After Sign-up

1. Still in **Paths** section
2. Look for **"After sign-up URL"**
3. Set to: `/app`

### Step 3: Configure Organization Settings

1. Go to **"Organizations"** in left sidebar
2. Scroll to **"Invitation Settings"**
3. Look for **"After accepting invitation"** redirect
4. Set to: `/app` or leave blank to use default

### Step 4: Add Allowed Redirect URLs

1. Go to **"Domains"** in left sidebar
2. Add your allowed redirect URLs:
   - `http://localhost:3000/*` (for development)
   - `https://yourdomain.com/*` (for production)

## Alternative: Update .env.local

Make sure your `.env.local` has:

```bash
# Already updated
VITE_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app

# Also add these if not present:
VITE_CLERK_AFTER_SIGN_UP_URL=/app
VITE_CLERK_AFTER_SIGN_IN_URL=/app
```

## How Clerk Invitation Flow Works

```
1. Admin creates invitation via your app
   ↓
2. Clerk Backend API creates invitation
   ↓
3. Clerk sends email with link to their hosted pages
   ↓
4. User clicks link → Goes to Clerk's hosted signup
   ↓
5. User completes signup on Clerk's pages
   ↓
6. Clerk redirects to URL configured in Dashboard
   ↓ (THIS IS WHERE THE BUG IS!)
7. Should go to: https://yourapp.com/app
   Currently going to: dashboard.clerk.com ❌
```

## Test After Configuration

1. **Configure Clerk Dashboard** (steps above)
2. **Restart dev server**:
   ```bash
   cd apps/web
   npm run dev
   ```
3. **Send new invitation**
4. **Accept invitation**
5. **Should now redirect to `/app`** ✅

## If Still Not Working

### Check Clerk's Email Template

The invitation email might have a hardcoded redirect URL:

1. Go to **Clerk Dashboard → Emails & SMS**
2. Find **"Organization Invitation"** template
3. Check the invitation link
4. Should be: `{{invitation_url}}`
5. NOT hardcoded to: `https://dashboard.clerk.com/...`

### Enable Logging

Check browser console for redirect URL:
```javascript
// After signup, check:
console.log("Clerk redirect:", window.location.href);
```

## Quick Fix (Temporary)

If you can't access Clerk Dashboard right now, you can force redirect in your app:

1. In `apps/web/src/main.tsx` or root component:
```typescript
// Add after Clerk provider
useEffect(() => {
  // If we're on Clerk's dashboard, redirect to app
  if (window.location.hostname.includes('clerk.com')) {
    window.location.href = 'http://localhost:3000/app';
  }
}, []);
```

But this is a HACK - proper fix is in Clerk Dashboard!

## Summary

**The issue is NOT in your code** - it's in Clerk's configuration. You need to tell Clerk where to redirect users after they accept invitations and sign up.

**Fix**: Configure "After sign-up URL" in Clerk Dashboard → Paths

Let me know once you've updated the Dashboard settings!
