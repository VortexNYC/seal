# Issues - Free Subscription Auto-Enrollment

## Problems Found
(None yet - will be populated as issues arise)

## Gotchas
- Sync MUST run before testing or price lookup will fail
- Lookup key is case-sensitive - must be exactly "free:personal:monthly:v1"
- Webhook processing takes 5-10 seconds

## [2026-01-26T17:05] Task 5: Verification - ISSUE FOUND

### Problem: Stripe Customer ID Mismatch
- User in Convex has `stripeCustomerId`: cus_Trd5IQ4jG1VJ5Y
- Stripe API returns: "No such customer: 'cus_Trd5IQ4jG1VJ5Y'"
- This indicates the auto-enrollment partially failed

### What Worked:
✅ User created in Clerk
✅ Webhook triggered (user synced to Convex)
✅ handleNewUserSignup action started
✅ stripeCustomerId was written to Convex

### What Failed:
❌ Stripe customer was NOT actually created in Stripe
❌ No subscription created (because customer creation failed)

### Possible Causes:
1. Stripe API key mismatch (test vs live mode)
2. Network error during Stripe customer creation
3. Stripe API error that was caught but not properly handled
4. Race condition in customer creation

### Next Steps:
- Check if STRIPE_SECRET_KEY is for test mode
- Verify Stripe API is accessible
- Check Convex logs for Stripe API errors
- May need to manually trigger auto-enrollment for this user


## [2026-01-26T17:08] Root Cause Analysis

### Confirmed: Stripe Customer Creation Failed

**Evidence:**
1. User exists in Convex with stripeCustomerId: cus_Trd5IQ4jG1VJ5Y
2. Stripe API (live mode) returns: "No such customer: cus_Trd5IQ4jG1VJ5Y"
3. No recent customers found in Stripe live mode
4. Products synced are from live mode (prod_xxx, price_xxx without test_ prefix)

### What This Means:
- The handleNewUserSignup action ran
- It attempted to create a Stripe customer
- The customer creation FAILED in Stripe
- BUT the code still wrote the customer ID to Convex (this is a bug)
- No subscription was created (because customer doesn't exist)

### Likely Cause:
The code in `getOrCreateStripeCustomer()` may have:
1. Generated a customer ID locally instead of from Stripe API
2. OR caught an error but still returned a customer ID
3. OR there's a race condition/timing issue

### Impact on Auto-Enrollment:
- Configuration: ✅ Correct
- Code execution: ✅ Ran
- Stripe API call: ❌ Failed
- Result: Partial failure - user has fake customer ID

### Next Steps:
Need to investigate the `getOrCreateStripeCustomer()` function to understand
why it's writing a customer ID when Stripe customer creation fails.

