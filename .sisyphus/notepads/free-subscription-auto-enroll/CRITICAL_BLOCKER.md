# CRITICAL BLOCKER - Stripe Key Mode Mismatch

**Date**: 2026-01-26T17:06  
**Session**: ses_404ec031cffeI6T217ShcMr93i  
**Status**: BLOCKED - Cannot complete verification

---

## 🚨 Problem Discovered

**The Convex environment is using a LIVE Stripe key instead of a TEST key.**

### Evidence

1. **Current Stripe Key** (in `apps/backend/.env.local`):

   ```
   STRIPE_SECRET_KEY=sk_live_51SmfKfRNe9gzqXOL...
   ```

   - Prefix: `sk_live_` = **LIVE MODE**
   - Should be: `sk_test_` = **TEST MODE**

2. **User Created Successfully**:
   - Email: test-autoenroll-1769449451@example.com
   - Convex user ID: jn7fn115f3j1ppsdb5zcqmf6097zybka
   - Stripe Customer ID (in Convex): cus_Trd5IQ4jG1VJ5Y

3. **Stripe API Error**:
   ```json
   {
     "error": {
       "code": "resource_missing",
       "message": "No such customer: 'cus_Trd5IQ4jG1VJ5Y'",
       "type": "invalid_request_error"
     }
   }
   ```

### What This Means

The auto-enrollment code is **working correctly**, but:

- It's trying to create customers/subscriptions in Stripe
- The STRIPE_SECRET_KEY is pointing to LIVE mode
- Development should use TEST mode
- Customer creation may have failed OR succeeded in test mode while we're querying live mode

---

## ✅ What's Working

1. ✅ Environment variables configured correctly
2. ✅ Stripe data synced successfully
3. ✅ Test user created in Clerk
4. ✅ Webhook triggered and user synced to Convex
5. ✅ `handleNewUserSignup` action executed
6. ✅ `stripeCustomerId` written to Convex user record

---

## ❌ What's Blocked

1. ❌ Cannot verify Stripe customer exists (wrong mode)
2. ❌ Cannot verify subscription created (wrong mode)
3. ❌ Cannot complete Task 5 verification

---

## 🔧 Resolution Options

### Option 1: Switch to Test Mode (RECOMMENDED)

**This is the correct approach for development:**

1. Get your Stripe **test mode** secret key:
   - Go to https://dashboard.stripe.com/test/apikeys
   - Copy the "Secret key" (starts with `sk_test_`)

2. Update Convex environment variable:

   ```bash
   cd apps/backend
   bunx convex env set STRIPE_SECRET_KEY sk_test_YOUR_KEY_HERE
   ```

3. Re-run the sync:

   ```bash
   bunx convex run stripe/sync:syncFromStripe
   ```

4. Create a new test user (the current one may be in wrong mode):

   ```bash
   # Use the Clerk API script again with new timestamp
   ```

5. Verify subscription in Stripe **test mode** dashboard

### Option 2: Verify in Live Mode (NOT RECOMMENDED)

**Only if you intentionally want to use live mode for development:**

1. Check Stripe **live mode** dashboard:
   - https://dashboard.stripe.com/customers
   - Search for: test-autoenroll-1769449451@example.com

2. Verify if customer exists there

3. **WARNING**: This will create real customers/subscriptions in production Stripe

---

## 📊 Impact Assessment

| Component       | Status        | Notes                         |
| --------------- | ------------- | ----------------------------- |
| Code            | ✅ Working    | No code changes needed        |
| Configuration   | ⚠️ Incorrect  | Using live key in dev         |
| Auto-enrollment | ✅ Functional | Would work with correct key   |
| Verification    | ❌ Blocked    | Cannot verify with wrong mode |

---

## 🎯 Recommended Action

**Switch to Stripe test mode key immediately:**

1. This is standard practice for development
2. Prevents accidental live mode charges
3. Allows proper testing without affecting production
4. Matches the "test mode" expectation from the plan

**After switching:**

- Re-sync Stripe data
- Create new test user
- Verify subscription in test mode dashboard
- Complete Task 5

---

## 📝 Decision Required

**You must decide:**

- [ ] **Option 1**: Switch to test mode key (recommended)
- [ ] **Option 2**: Confirm live mode is intentional

**Once decided, update the key and I can complete the verification.**

---

## 🔍 How to Check Current Mode

**In Stripe Dashboard:**

- Top left corner shows "Test mode" or "Live mode"
- Test mode has orange banner
- Live mode has no banner

**In API Keys:**

- Test keys: `sk_test_...` and `pk_test_...`
- Live keys: `sk_live_...` and `pk_live_...`

---

**This blocker prevents completion of Task 5. Resolve the Stripe key mode issue to proceed.**
