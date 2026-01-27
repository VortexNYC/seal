# Verification Checklist - Task 5

**Test User Created:**
- Email: test-autoenroll-1769449451@example.com
- Clerk User ID: user_38ny6SpjQ0vyVQrX2y4OzVRX1HG
- Created: 2026-01-26T17:01

---

## Manual Verification Required

### 1. Convex Dashboard - Users Table

**Steps:**
1. Go to Convex Dashboard: https://dashboard.convex.dev
2. Select deployment: `dev:amicable-nightingale-638`
3. Navigate to **Data** → **users** table
4. Search for email: `test-autoenroll-1769449451@example.com`

**Expected:**
- [ ] User record exists
- [ ] `stripeCustomerId` field is populated (format: `cus_xxx`)
- [ ] `email` matches: `test-autoenroll-1769449451@example.com`
- [ ] `clerkId` matches: `user_38ny6SpjQ0vyVQrX2y4OzVRX1HG`

**Record the stripeCustomerId**: ___________________

---

### 2. Convex Dashboard - Subscriptions Table

**Steps:**
1. In Convex Dashboard, navigate to **Data** → **subscriptions** table
2. Filter by the `userId` from step 1 (the `_id` field of the user)

**Expected:**
- [ ] Subscription record exists for this user
- [ ] `status` = `"active"`
- [ ] `externalPriceId` starts with `price_` (Stripe price ID)
- [ ] `creditsIncluded` > 0 (likely 10 for free plan)
- [ ] `creditsRemaining` = `creditsIncluded`
- [ ] `creditsUsed` = 0

**Record the subscription details:**
- Subscription ID: ___________________
- External Price ID: ___________________
- Credits Included: ___________________
- Status: ___________________

---

### 3. Stripe Dashboard - Customers

**Steps:**
1. Go to Stripe Dashboard: https://dashboard.stripe.com/test/customers
2. Search for email: `test-autoenroll-1769449451@example.com`

**Expected:**
- [ ] Customer exists with matching email
- [ ] Customer ID matches the `stripeCustomerId` from Convex
- [ ] Customer has an active subscription

**Record the Stripe customer ID**: ___________________

---

### 4. Stripe Dashboard - Subscriptions

**Steps:**
1. Click into the customer from step 3
2. Go to the **Subscriptions** tab

**Expected:**
- [ ] Active subscription exists
- [ ] Subscription shows "Free Plan - Personal" or similar
- [ ] Price lookup key: `free:personal:monthly:v1`
- [ ] Status: Active
- [ ] Amount: $0.00 (or metered)

**Record the subscription details:**
- Subscription ID: ___________________
- Plan Name: ___________________
- Status: ___________________

---

## Success Criteria Summary

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| User has stripeCustomerId | cus_xxx | _______ | [ ] |
| Subscription exists in Convex | Yes | _______ | [ ] |
| Subscription status | active | _______ | [ ] |
| Subscription externalPriceId | price_xxx | _______ | [ ] |
| Stripe customer exists | Yes | _______ | [ ] |
| Stripe subscription active | Yes | _______ | [ ] |
| Lookup key matches | free:personal:monthly:v1 | _______ | [ ] |

---

## If Verification Fails

### User has no stripeCustomerId
**Likely Cause:** `handleNewUserSignup` action failed  
**Fix:** Check Convex logs for errors

### stripeCustomerId exists but no subscription
**Likely Cause:** `AUTO_ENROLL_FREE_PLAN_ON_SIGNUP` not set OR price not found  
**Fix:** Verify env var is set and price exists in subscription_prices table

### Logs show "Price not found"
**Likely Cause:** subscription_prices table missing the price  
**Fix:** Re-run sync: `bunx convex run stripe/sync:syncFromStripe`

### No logs at all
**Likely Cause:** Clerk webhook not reaching Convex  
**Fix:** Check Clerk webhook delivery status in Clerk Dashboard

---

## Automated Verification (Optional)

If you have access to Convex CLI, you can run:

```bash
# Check if user exists
cd apps/backend
bunx convex run --no-push organizations/helpers:getUserByClerkId \
  '{"clerkId": "user_38ny6SpjQ0vyVQrX2y4OzVRX1HG"}'

# This would show the user record including stripeCustomerId
```

---

**Complete this checklist and mark Task 5 as complete in the plan.**
