# Next Steps - Free Subscription Auto-Enrollment

## ✅ Completed Tasks (3/5)

### Task 1: Pre-flight Checks ✅
- ✅ STRIPE_SECRET_KEY confirmed in Convex dev environment
- ✅ CLERK_WEBHOOK_SECRET confirmed
- ⚠️ Manual verification still recommended:
  - Stripe Dashboard: Confirm lookup_key = "free:personal:monthly:v1"
  - Clerk Dashboard: Confirm webhook URL points to Convex dev

### Task 2: Sync Stripe Data ✅
- ✅ Synced 4 products successfully
- ✅ Confirmed `free:personal:monthly:v1` exists in subscription_prices table
- ✅ Price status: active, type: metered (monthly recurring)

### Task 3: Configure Environment Variables ✅
- ✅ AUTO_ENROLL_FREE_PLAN_ON_SIGNUP=true
- ✅ DEFAULT_PLAN_LOOKUP_KEY=free:personal:monthly:v1
- ✅ Both variables confirmed in Convex dev environment

---

## 🔄 Current Task (4/5) - REQUIRES YOUR ACTION

### Task 4: Create Test User

**You need to manually create a test user to trigger the auto-enrollment flow.**

#### Option 1: Via Clerk Dashboard (Recommended)
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your **dev environment**
3. Navigate to **Users**
4. Click **"Create User"**
5. Use this email format: `test-autoenroll-<timestamp>@example.com`
   - Example: `test-autoenroll-1738000000@example.com`
6. Fill in required fields (name, password, etc.)
7. Click **Create**

#### Option 2: Via Your Web App
1. Navigate to your dev/preview app URL
2. Click **Sign Up**
3. Use email: `test-autoenroll-<timestamp>@example.com`
4. Complete the signup flow

#### After Creating the User:
1. **Wait 10 seconds** for webhook processing
2. **Check Convex logs**:
   ```bash
   cd apps/backend
   bunx convex logs --history 50
   ```
3. **Look for these log messages**:
   - `[Clerk Webhook] User synced: user_xxx`
   - `Created Stripe customer cus_xxx for user xxx`
   - `Auto-enrolled user xxx to plan free:personal:monthly:v1 with subscription sub_xxx`

---

## ⏳ Pending Task (5/5)

### Task 5: Verify Subscription Created

**After you create the test user, I will verify:**

1. **Convex Database Checks**:
   - User has `stripeCustomerId` in `users` table
   - Subscription record exists in `subscriptions` table with:
     - `status` = "active"
     - `externalPriceId` matches free plan price
     - `creditsIncluded` = expected value

2. **Stripe Dashboard Checks**:
   - Customer exists with test email
   - Active subscription showing free plan

---

## 🎯 Success Criteria

When Task 5 is complete, you will have confirmed:
- ✅ New users automatically get a Stripe customer created
- ✅ New users automatically get enrolled in the free plan
- ✅ Subscription is active in both Convex and Stripe
- ✅ The lookup key `free:personal:monthly:v1` is correctly used

---

## 📊 Current Status

| Task | Status | Notes |
|------|--------|-------|
| 1. Pre-flight Checks | ✅ Complete | STRIPE_SECRET_KEY confirmed |
| 2. Sync Stripe Data | ✅ Complete | free:personal:monthly:v1 synced |
| 3. Configure Env Vars | ✅ Complete | Both variables set in dev |
| 4. Create Test User | 🔄 **WAITING FOR YOU** | Manual action required |
| 5. Verify Subscription | ⏳ Pending | Depends on Task 4 |

---

## 🚀 What to Do Now

**Create a test user using one of the methods above, then let me know when it's done.**

I'll then proceed with Task 5 to verify the subscription was created successfully.
