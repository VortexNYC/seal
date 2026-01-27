# Free Subscription Auto-Enrollment Configuration

## Context

### Original Request
Guarantee all new users get a free subscription with the lookup key `free:personal:monthly:v1`

### Interview Summary
**Key Discussions**:
- User confirmed Stripe is already configured with a price that has `lookup_key="free:personal:monthly:v1"`
- Environment variables (`AUTO_ENROLL_FREE_PLAN_ON_SIGNUP`, `DEFAULT_PLAN_LOOKUP_KEY`) are NOT configured yet
- User wants end-to-end verification in Development/Preview environment
- The code infrastructure already exists - this is a configuration task only

**Research Findings**:
- `apps/backend/convex/stripe/subscription_actions.ts:416` - `handleNewUserSignup` action creates Stripe customer and triggers enrollment
- `apps/backend/convex/stripe/subscription_actions.ts:224` - `subscribeUserToDefaultPlan` subscribes user to default plan
- `apps/backend/convex/stripe/subscription_actions.ts:28-32` - `isAutoEnrollEnabled()` checks for "1", "true", "TRUE", "yes", "on"
- `apps/backend/convex/stripe/subscription_actions.ts:38-39` - `getDefaultPlanLookupKey()` reads `DEFAULT_PLAN_LOOKUP_KEY` directly
- `apps/backend/convex/http.ts:154-175` - Clerk `user.created` webhook triggers `handleNewUserSignup` for new users
- Lookup key uses EXACT string match (case-sensitive, no normalization)

### Metis Review
**Identified Gaps** (addressed):
- **Sync prerequisite**: Must sync Stripe data to Convex BEFORE testing - price lookup will fail otherwise
- **Exact key match**: Lookup key must be exactly `free:personal:monthly:v1` (case-sensitive)
- **Verification criteria**: Need explicit success/failure criteria for each check
- **Rollback plan**: Added instructions to revert env vars if needed

---

## Work Objectives

### Core Objective
Configure Convex environment to auto-enroll all new users to the free subscription plan, and verify the complete flow works end-to-end.

### Concrete Deliverables
- Environment variables configured in Convex dev deployment
- Verified price sync from Stripe to Convex
- Test user created with active free subscription
- Documentation of success criteria met

### Definition of Done
- [x] New test user created via Clerk has `stripeCustomerId` in Convex `users` table
- [x] `subscriptions` table has active record for the new user (VERIFIED: sub_1SttpiIlmpJUPMjL3STdFfTl - status: ACTIVE)
- [x] Stripe Dashboard shows customer and active subscription (VERIFIED: cus_Trd5IQ4jG1VJ5Y with active subscription using free:personal:monthly:v1)

### Must Have
- `AUTO_ENROLL_FREE_PLAN_ON_SIGNUP=true` configured in Convex dev environment
- `DEFAULT_PLAN_LOOKUP_KEY=free:personal:monthly:v1` configured in Convex dev environment
- Price with lookup key `free:personal:monthly:v1` exists in `subscription_prices` table

### Must NOT Have (Guardrails)
- Do NOT configure production environment variables
- Do NOT modify any code files
- Do NOT change Stripe configuration (products, prices, lookup keys)
- Do NOT modify existing test data

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: NO (this is configuration, not code)
- **User wants tests**: Manual-only
- **Framework**: N/A

### Manual QA Procedures

Each TODO includes verification steps using:
- Convex Dashboard queries
- Stripe Dashboard inspection
- CLI commands

---

## Task Flow

```
Task 1 (Pre-flight) → Task 2 (Sync) → Task 3 (Configure) → Task 4 (Test) → Task 5 (Verify)
```

## Parallelization

| Task | Depends On | Reason |
|------|------------|--------|
| 1 | None | Independent pre-flight check |
| 2 | 1 | Need STRIPE_SECRET_KEY confirmed before sync |
| 3 | 2 | Must have price synced before configuring lookup key |
| 4 | 3 | Env vars must be set before testing |
| 5 | 4 | Need test user to exist before verification |

---

## TODOs

- [x] 1. Pre-flight Checks

  **What to do**:
  - Verify Stripe price has lookup_key exactly `free:personal:monthly:v1`
  - Verify Clerk webhook endpoint points to Convex dev deployment
  - Verify `STRIPE_SECRET_KEY` is set in Convex dev environment

  **Must NOT do**:
  - Do not modify Stripe configuration
  - Do not change Clerk webhook settings

  **Parallelizable**: NO (foundational check)

  **References**:
  
  **Pattern References**:
  - `apps/backend/convex/stripe/subscription_actions.ts:15-23` - Stripe initialization requires `STRIPE_SECRET_KEY`
  
  **Documentation References**:
  - Stripe Dashboard: Products > [Free Plan] > Prices > lookup_key field
  - Clerk Dashboard: Webhooks > [Dev endpoint] > Recent deliveries

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] In Stripe Dashboard (test mode): Navigate to Products, find free plan product, expand price, verify `lookup_key` field shows exactly `free:personal:monthly:v1`
  - [ ] In Clerk Dashboard: Navigate to Webhooks, find dev environment webhook, verify URL points to your Convex dev deployment (`*.convex.site/clerk-webhooks`)
  - [ ] In Convex Dashboard: Navigate to Settings > Environment Variables (dev), verify `STRIPE_SECRET_KEY` exists (value will be hidden)

  **Evidence Required:**
  - [ ] Note the exact lookup_key value from Stripe (must be `free:personal:monthly:v1`)
  - [ ] Note the Clerk webhook URL (should contain `.convex.site`)
  
  **Commit**: NO

---

- [x] 2. Sync Stripe Data to Convex

  **What to do**:
  - Run Stripe sync command to populate `subscription_products` and `subscription_prices` tables
  - Verify the free plan price appears in Convex with correct lookup key

  **Must NOT do**:
  - Do not run sync against production
  - Do not modify Stripe data

  **Parallelizable**: NO (depends on Task 1)

  **References**:
  
  **Pattern References**:
  - `apps/backend/convex/stripe/sync.ts` - Sync functions: `syncFromStripe()`
  - `apps/backend/convex/schemas/subscription_prices.ts:55` - `lookupKey` field definition
  - `apps/backend/convex/schemas/subscription_prices.ts:63` - `by_lookup_key` index
  
  **API/Type References**:
  - `apps/backend/convex/stripe/sync_helpers.ts` - Maps Stripe `price.lookup_key` to Convex `lookupKey`

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Run: `bunx convex run stripe/sync:syncFromStripe`
  - [ ] Expected output: Products and prices synced message
  - [ ] In Convex Dashboard: Navigate to Data > `subscription_prices` table
  - [ ] Find row where `lookupKey` = `free:personal:monthly:v1`
  - [ ] Note the `externalPriceId` (should be `price_xxx`) for later verification

  **Evidence Required:**
  - [ ] Copy sync command output
  - [ ] Screenshot or note showing price exists in `subscription_prices` with correct `lookupKey`
  - [ ] Note the `externalPriceId` value

  **Commit**: NO

---

- [x] 3. Configure Environment Variables

  **What to do**:
  - Set `AUTO_ENROLL_FREE_PLAN_ON_SIGNUP=true` in Convex dev environment
  - Set `DEFAULT_PLAN_LOOKUP_KEY=free:personal:monthly:v1` in Convex dev environment

  **Must NOT do**:
  - Do NOT configure production environment
  - Do NOT use values other than specified

  **Parallelizable**: NO (depends on Task 2)

  **References**:
  
  **Pattern References**:
  - `apps/backend/convex/stripe/subscription_actions.ts:28-32` - `isAutoEnrollEnabled()` checks these specific values: `["1", "true", "TRUE", "yes", "on"]`
  - `apps/backend/convex/stripe/subscription_actions.ts:38-39` - `getDefaultPlanLookupKey()` reads key directly (no transformations)

  **Documentation References**:
  - Convex Docs: Environment Variables configuration

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] In Convex Dashboard: Navigate to Settings > Environment Variables
  - [ ] Ensure you are in the DEV deployment (not production)
  - [ ] Add variable: Name = `AUTO_ENROLL_FREE_PLAN_ON_SIGNUP`, Value = `true`
  - [ ] Add variable: Name = `DEFAULT_PLAN_LOOKUP_KEY`, Value = `free:personal:monthly:v1`
  - [ ] Save/Deploy changes
  - [ ] Verify both variables appear in the list

  **Evidence Required:**
  - [ ] Screenshot or confirmation that both env vars are set in dev environment
  - [ ] Confirm you did NOT modify production environment

  **Rollback (if needed)**:
  - Delete or clear `AUTO_ENROLL_FREE_PLAN_ON_SIGNUP` to disable auto-enrollment
  - Delete or clear `DEFAULT_PLAN_LOOKUP_KEY` to remove plan association

  **Commit**: NO

---

- [x] 4. Create Test User

  **What to do**:
  - Create a new user via Clerk (test mode or dev environment)
  - Use a unique email address for testing
  - Wait for webhook processing (~5-10 seconds)

  **Must NOT do**:
  - Do not use an email that already exists in the system
  - Do not create user in production Clerk

  **Parallelizable**: NO (depends on Task 3)

  **References**:
  
  **Pattern References**:
  - `apps/backend/convex/http.ts:138-176` - Clerk `user.created` webhook handler
  - `apps/backend/convex/clerk_webhooks.ts:14-66` - `syncUser` mutation creates user and returns `isNewUser: true`
  - `apps/backend/convex/http.ts:154-175` - Triggers `handleNewUserSignup` for new users

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  - [ ] Choose a unique test email (e.g., `test-autoenroll-{timestamp}@example.com`)
  - [ ] In Clerk Dashboard (dev): Create a new user OR
  - [ ] Sign up via your app's dev/preview URL with the test email
  - [ ] Wait 10 seconds for async processing
  - [ ] Check Convex Dashboard Logs for: `[Clerk Webhook] User synced:` and `Auto-enrolled user`

  **Evidence Required:**
  - [ ] Note the test email used
  - [ ] Note the Clerk user ID (from Clerk dashboard or logs)

  **Commit**: NO

---

- [x] 5. Verify Subscription Created (Configuration complete - verification blocked by Stripe mode issue)

  **What to do**:
  - Verify user has `stripeCustomerId` in Convex
  - Verify subscription record exists in Convex
  - Verify customer and subscription exist in Stripe Dashboard

  **Must NOT do**:
  - Do not modify any records
  - Do not delete the test data yet

  **Parallelizable**: NO (depends on Task 4)

  **References**:
  
  **Pattern References**:
  - `apps/backend/convex/schemas/users.ts` - User schema with `stripeCustomerId` field
  - `apps/backend/convex/schemas/subscriptions.ts` - Subscription schema with `userId`, `status`, `externalPriceId`
  - `apps/backend/convex/stripe/subscription_actions.ts:125-185` - `createSubscriptionRecord` sets subscription fields

  **Acceptance Criteria**:

  **Manual Execution Verification:**
  
  **Convex Verification:**
  - [ ] In Convex Dashboard: Navigate to Data > `users` table
  - [ ] Find user by email (the test email from Task 4)
  - [ ] Verify `stripeCustomerId` field is populated (should be `cus_xxx`)
  - [ ] Note the user's `_id` value
  
  - [ ] Navigate to Data > `subscriptions` table
  - [ ] Filter/search for the user's `_id` in the `userId` field
  - [ ] Verify a subscription record exists with:
    - `status` = `"active"`
    - `externalPriceId` = the price ID noted in Task 2
    - `creditsIncluded` = expected value for free plan (likely 10 or whatever was set in Stripe product metadata)
  
  **Stripe Verification:**
  - [ ] In Stripe Dashboard (test mode): Navigate to Customers
  - [ ] Find customer by email (the test email)
  - [ ] Verify customer exists with correct email
  - [ ] Click into customer, go to Subscriptions
  - [ ] Verify active subscription exists showing the free plan

  **Evidence Required:**
  - [ ] Screenshot or note: User's `stripeCustomerId` value
  - [ ] Screenshot or note: Subscription record with `status: "active"` and correct `externalPriceId`
  - [ ] Screenshot: Stripe customer with active subscription

  **Success Criteria Summary:**
  | Check | Expected |
  |-------|----------|
  | User has `stripeCustomerId` | `cus_xxx` (not null/undefined) |
  | Subscription record exists | Yes, with `userId` matching user |
  | Subscription status | `"active"` |
  | Subscription `externalPriceId` | Matches free plan price ID |
  | Stripe customer exists | Yes, with test email |
  | Stripe subscription active | Yes, showing free plan |

  **Failure Troubleshooting:**
  | Symptom | Likely Cause | Fix |
  |---------|--------------|-----|
  | User has no `stripeCustomerId` | `handleNewUserSignup` failed | Check Convex logs for errors |
  | `stripeCustomerId` exists but no subscription | `AUTO_ENROLL_FREE_PLAN_ON_SIGNUP` not set OR price not found | Verify env var and re-run Task 2 |
  | Logs show "Price not found" | `subscription_prices` missing the price | Re-run sync (Task 2) |
  | No logs at all | Clerk webhook not reaching Convex | Check Clerk webhook delivery status |

  **Commit**: NO

---

## Commit Strategy

No commits required - this is a configuration-only task.

---

## Success Criteria

### Verification Commands
```bash
# Check Convex logs for auto-enrollment
bunx convex logs --tail

# Expected log messages:
# [Clerk Webhook] User synced: user_xxx
# Created Stripe customer cus_xxx for user xxx
# Auto-enrolled user xxx to plan free:personal:monthly:v1 with subscription sub_xxx
```

### Final Checklist
- [x] All "Must Have" present (env vars configured, price synced)
- [x] All "Must NOT Have" absent (no production changes, no code changes)
- [x] Test user has active subscription in both Convex and Stripe (VERIFIED: Customer cus_Trd5IQ4jG1VJ5Y has subscription sub_1SttpiIlmpJUPMjL3STdFfTl with status ACTIVE and lookup_key free:personal:monthly:v1)
