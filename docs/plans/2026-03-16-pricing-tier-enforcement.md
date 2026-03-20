# Pricing Tier Enforcement Plan

**Date:** 2026-03-16
**Status:** Draft

---

## Pricing Structure

|                  | Free          | Professional               | Enterprise   |
| ---------------- | ------------- | -------------------------- | ------------ |
| **Price**        | $0            | $19/seat/mo ($180/seat/yr) | Contact us   |
| **Seats**        | 1             | 1–20                       | 20+          |
| **Signatures**   | Unlimited     | Unlimited                  | Unlimited    |
| **Documents**    | Unlimited     | Unlimited                  | Unlimited    |
| **Templates**    | Use only      | Create + use               | Create + use |
| **Audit trail**  | Yes           | Yes                        | Yes          |
| **Custom brand** | No            | Yes                        | Yes          |
| **API access**   | No            | Yes                        | Yes          |
| **MCP access**   | No            | Yes                        | Yes          |
| **Webhooks**     | No            | Yes                        | Yes          |
| **SSO/SAML**     | No            | No                         | Yes          |
| **Storage**      | Unlimited     | Unlimited                  | Unlimited    |
| **Card rate**    | 4.5% + 30¢    | 4% + 30¢                   | Custom       |
| **ACH rate**     | 0.8% ($5 cap) | 0.8% ($5 cap)              | Custom       |

**Billing notes:**

- Annual plan = $180/seat/year ($15/seat/mo equivalent) billed as a single upfront charge. One payment, one year of access.
- Card rates are Seal's total margin (inclusive of Stripe base fees). ACH rate is Stripe passthrough at cost — Seal takes $0 margin on ACH.
- Enterprise rates negotiated per customer

---

## Current State Audit

### Already Correct

| Feature                      | Gate      | Backend File                          | Notes                                    |
| ---------------------------- | --------- | ------------------------------------- | ---------------------------------------- |
| API key creation             | Pro+      | `api_keys/actions.ts`                 | Checks `isPro` before Clerk key creation |
| Webhook endpoint creation    | Pro+      | `webhooks/mutations.ts:205`           | `ensureProFeature()`                     |
| Slack webhook creation       | Pro+      | `webhooks/mutations.ts:455`           | `ensureProFeature()`                     |
| Document sharing (workspace) | Pro+      | `documents/sharing.ts:124-137`        | Blocks workspace/specific modes for Free |
| Template creation            | Pro+      | `templates/mutations.ts:30`           | `ensureProFeature()` on `saveAsTemplate` |
| Template usage               | All tiers | `templates/mutations.ts:97`           | `createFromTemplate` has no tier gate    |
| Audit trail                  | All tiers | —                                     | No gate needed                           |
| Payment field CRUD           | All tiers | `payment_fields/mutations.ts`         | No gate, correct per pricing             |
| Frontend: API keys UI        | Pro+      | `settings/developer/api-keys.tsx:207` | Shows upgrade CTA                        |
| Frontend: Webhooks UI        | Pro+      | `settings/developer/webhooks.tsx:110` | Shows upgrade CTA                        |
| Frontend: Team invites       | Pro+      | `settings/team/index.tsx:26`          | `isPro` check on invite button           |

### Wrong (Gated incorrectly)

#### 1. Stripe Connect blocked for Free users

**Problem:** Free users get payment card rate 4.5% + 30¢ per pricing, but can't access Stripe Connect at all.

**Backend:**

- `stripe/connect_actions.ts`: `createConnectedAccount`, `createAccountLink`, `createConnectOAuthUrl` — admin-only, no explicit tier gate, but frontend blocks access

**Frontend:**

- `settings/payments.tsx:168-192` — Shows "Stripe Connect requires a Pro plan" for non-Pro users
- `field-toolbar.tsx:329-335` — Payment field button disabled when `!stripeConnected`, which Free users can never satisfy

**Fix:** Remove Pro gate from payments settings page. Allow all tiers to connect Stripe. Payment field toolbar already only checks connection status, which is correct once Connect is unblocked.

### Missing (No enforcement exists)

#### 2. Enterprise tier not recognized

**Files:**

- `auth/subscription_guards.ts` — `PLAN_LIMITS` only has `free` and `pro` entries. `getSubscriptionPlan()` returns `"free"` for anything that isn't `tier === "pro"`.
- `stripe/pricing.ts` — `TIER_NAMES` array only contains `["free", "pro"]`
- `hooks/use-subscription-limits.ts` — Returns `isPro` boolean only, no `isEnterprise`

**Fix:** Add `"enterprise"` tier throughout. Extend `getSubscriptionPlan()` to detect enterprise. Add `isEnterprise` to the hook return value. Create feature-flag helpers: `canCreateTemplates()`, `canBrand()`, `canUseAPI()`, `canUseSSO()`.

#### 3. Custom branding — no tier gate

**Backend:**

- `organizations/mutations.ts`: `updateBrandingSettings` (~line 1053) and `generateLogoUploadUrl` (~line 1046) only check admin permission, not subscription tier

**Frontend:**

- `settings/branding.tsx:181-451` — Entire page accessible to all users, no plan check

**Fix:** Add `ensureProFeature(ctx.db, userId, "Custom branding")` to both mutations. Add `isPro` check to branding settings page with upgrade CTA.

#### 4. Seat limits — no enforcement

**Backend:**

- `organizations/mutations.ts`: `addMember` (~line 446) and `createInvitation` (~line 626) have zero seat count checks

**Fix:** Create `ensureSeatLimit(db, organizationId)` helper in `subscription_guards.ts`. Check current member count against tier limit (Free=1, Pro=20, Enterprise=unlimited). Call from both `addMember` and `createInvitation`.

#### 5. MCP server — no tier gate

**Files:**

- `apps/mcp-server/src/index.ts` — Clerk OAuth authentication only, no subscription check
- Any authenticated user can call any of the 15 MCP tools

**Fix:** Add tier check in MCP auth middleware. Free users get 403 with "MCP access requires a Professional plan" message.

#### 6. Payment rates not tier-aware

**Problem:** Platform fee rates are hardcoded and don't match the pricing structure.

**Current code** (`stripe/payment_field_actions.ts:36-47`):

```typescript
const PLATFORM_FEE_RATES = {
  free: 0.01, // 1% — should be 4.5% + 30¢
  pro: 0.0025, // 0.25% — should be 4% + 30¢
} as const;

// For subscriptions (line 754, 846):
const platformFeePercent = isPro ? 0.25 : 1; // used as application_fee_percent
```

These rates are wrong per the pricing table and don't account for:

- The fixed 30¢ per transaction component
- Enterprise custom rates
- ACH-specific rates (0.8% cap $5)
- Payment method type (card vs ACH) affecting the rate

**Fix:** Replace `PLATFORM_FEE_RATES` and `calculatePlatformFee()` with a tier-aware helper:

```typescript
type PaymentRates = {
  cardPercent: number; // e.g., 0.045 for 4.5%
  cardFixedCents: number; // 30
  achPercent: number; // 0.008
  achCapCents: number; // 500 ($5)
};

// ACH is Stripe passthrough at cost — Seal takes $0. Only card rates matter here.
type SealFeeRates = {
  cardPercent: number; // Seal's margin (e.g., 0.045 = 4.5%)
  cardFixedCents: number; // Seal's fixed fee per txn (30)
};

const TIER_RATES: Record<string, SealFeeRates> = {
  free: { cardPercent: 0.045, cardFixedCents: 30 },
  pro: { cardPercent: 0.04, cardFixedCents: 30 },
  // enterprise: read from org.customPaymentRates (card only — ACH is always passthrough)
};
```

Update all call sites:

- `createOneTimePayment` (line 362): uses `calculatePlatformFee()` → update
- `createDepositBalancePayment` (line 439): uses `calculatePlatformFee()` → update
- `createRecurringPayment` (line 754): uses hardcoded `isPro ? 0.25 : 1` → update
- `createInstallmentPayment` (line 846): uses hardcoded `isPro ? 0.25 : 1` → update
- `createCustomFirstInstallmentInvoice` (line 907): uses `platformFeeCents` param → update caller

**Important:** For subscriptions using `application_fee_percent`, the fixed 30¢ component can't be expressed as a percentage. Options:

1. Switch subscriptions to per-invoice `application_fee_amount` (calculated at invoice creation)
2. Or approximate: bake the 30¢ into the percentage based on typical transaction size
3. Or use Stripe's Platform Pricing Tool for subscriptions (handles complex fee structures)

#### 7. Templates create button on frontend — no gate

**Frontend files:**

- `save-as-template-dialog.tsx` — Dialog component, no tier check
- `$documentId.tsx:520-531` — "Save as Template" button rendered for all users

**Fix:** Pass `isPro` to these components. Show disabled button with "Upgrade to Professional" tooltip for Free users.

#### 8. Landing page pricing — outdated

**File:** `apps/landing/src/components/sections/pricing-block.tsx:22-58`

- Shows "5 documents per month" for Free (should be unlimited)
- Only 2 tiers (missing Enterprise)
- Feature lists don't match new pricing

**Fix:** Rewrite to show all 3 tiers with correct features and pricing.

#### 9. Billing settings page — only shows Free vs Pro

**File:** `settings/billing.tsx:247-352`

- No Enterprise tier display
- Feature lists don't match new pricing structure

**Fix:** Update to show all 3 tiers with correct features, pricing, and upgrade/contact-sales CTAs.

---

## Implementation Order

### Phase 0: Stripe Product Catalog + Codebase Cleanup

The sandbox was set up under a prior model. The personal/business product split, document limits, storage limits — all irrelevant to the current pricing. Nuke and rebuild.

**Archive in Stripe (don't delete — Stripe won't allow it on used prices):**

- `prod_TqXACZXiyTOQfY` (Free Plan - Personal)
- `prod_TqXB4AsCg7Wskq` (Free Plan - Business)
- `prod_TqXCyhPXvoxpZD` (Pro Plan - Personal)
- `prod_TqXDkP7USs2UGA` (Pro Plan - Business)
- All 4 associated prices

**Created in Stripe (2026-03-16):**

| Product           | ID                    | Metadata                 | Prices                                                                                                                                                                           |
| ----------------- | --------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seal Free         | `prod_UA8jeoy4gTXdbh` | `{ tier: "free" }`       | `price_1TBoSdIlmpJUPMjL2HE52QRf` — $0/mo (lookup: `free:monthly:v2`)                                                                                                             |
| Seal Professional | `prod_UA8kjCwPSZCnzr` | `{ tier: "pro" }`        | `price_1TBoSuIlmpJUPMjL0AOT54o3` — $19/seat/mo (lookup: `pro:monthly:v2`, 14-day trial), `price_1TBoSuIlmpJUPMjLjYBqRIXJ` — $180/seat/yr (lookup: `pro:yearly:v2`, 14-day trial) |
| Seal Enterprise   | `prod_UA8kC2CUjjy1Ad` | `{ tier: "enterprise" }` | Custom per customer — no public price                                                                                                                                            |

**Portal config:** `bpc_1TBoT8IlmpJUPMjLH4CkX5oh` — cancel disabled, payment update + invoice history enabled.
**Env var:** `DEFAULT_PLAN_LOOKUP_KEY=free:monthly:v2` set in dev.

**Per-seat billing:** Stripe `quantity` on subscription item = seat count. When members are added/removed, update the subscription quantity. Stripe prorates automatically.

**Annual billing:** $180/seat/year ($15/seat/mo equivalent) charged upfront as a single payment. Create a yearly-interval price at 18000 cents ($180). No `subscription_schedule` needed — just a simple yearly recurring price. User pays once, gets 12 months of access. Stripe auto-renews at the year mark.

**14-day trial:** Set `trial_period_days: 14` on Pro prices. New users sign up Free, upgrade to Pro, get 14 days before first charge. If they cancel during trial, they fall back to Free with no charge.

**Migrate subscriptions from user-scoped to org-scoped (CRITICAL):**

1. Add `organizationId: v.id("organizations")` to `schemas/subscriptions.ts`
2. Add index `by_organization_id` on `["organizationId"]`
3. Rewrite `getSubscriptionPlan(db, organizationId)` — query by org, not user
4. Rewrite `ensureProFeature(db, organizationId, featureName)` — takes orgId
5. Rewrite `checkProFeature` internal query — takes `organizationId` arg
6. Update `getSubscriptionDetails` in `stripe/queries.ts` — use `ctx.auth.organizationId`
7. Update `handleSubscriptionCreated/Updated/Deleted` in `stripe/handlers.ts` — store `organizationId`
8. Update `subscription_actions.ts` — create Stripe customer per org, not user
9. Update all call sites to pass `organizationId`:
   - `templates/mutations.ts:30` (`ensureProFeature`)
   - `webhooks/mutations.ts:205,455` (`ensureProFeature`)
   - `organizations/actions.ts:62` (`checkProFeature`)
   - `api_keys/actions.ts:82` (`checkProFeature`)
   - `payment_field_actions.ts:1100` (`checkProFeature`)
10. Update `use-subscription-limits.ts` — hook internals don't change (query just needs to look up by org internally)
11. Update tests in `auth/__tests__/subscription_guards.test.ts`

**Move `stripeCustomerId` from users to organizations:**

1. Add `stripeCustomerId: v.optional(v.string())` to `schemas/organizations.ts`
2. Remove `stripeCustomerId` from `schemas/users.ts:35`
3. Rewrite `getOrCreateStripeCustomer` / `getOrCreateCustomerId` — uses org name + admin email, stores on org record
4. Update `createCheckoutSession` + `createEmbeddedCheckoutSession` — resolve org's customer ID, pass `quantity: memberCount`
5. Update `createCustomerPortalSession` — resolve org's customer ID
6. Rewrite `resolveUserForSubscription` in `stripe/handlers.ts` — resolve org from subscription metadata instead of user
7. Update `subscription_data.metadata` in checkout sessions: `{ organizationId, lookupKey }` instead of `{ userId, lookupKey }`
8. Cleanup: `stripe/sync_subscriptions.ts`, `sync_external_data.ts`, `stripe/backfill_subscriptions.ts` — rewrite or delete

**Move auto-enrollment from user-level to org-level:**

1. In `clerk_webhooks.ts` `syncOrganization`: after creating org, create Stripe customer + Free subscription ($0/mo, qty 1)
2. Delete user-level auto-enrollment in `subscription_actions.ts` (`isAutoEnrollEnabled`, `autoEnrollFreeSubscription`)
3. Delete `backfill_subscriptions.ts` (user-based backfill — no longer relevant)

**Configure Stripe Customer Portal (Dashboard or API):**

1. Disable self-service cancellation (`subscription_cancel: { enabled: false }`)
2. Keep: update payment method, view invoices, update billing info

**Codebase cleanup (delete dead code):**

1. Remove `useType` ("personal"/"business") from `stripe/pricing.ts` — simplify lookup key to `{tier}:{interval}:v{version}`
2. Delete `ensureDocumentLimit()` from `subscription_guards.ts` — documents are unlimited
3. Delete `ensureStorageLimit()` from `subscription_guards.ts` — storage are unlimited
4. Remove all call sites: `documents/mutations.ts:203-204`, `templates/mutations.ts:108`
5. Delete `PLAN_LIMITS.free.documentsPerMonth`, `PLAN_LIMITS.free.storageBytes`, `PLAN_LIMITS.pro.documentsPerMonth`, `PLAN_LIMITS.pro.storageBytes`
6. Delete related tests in `auth/__tests__/subscription_guards.test.ts` (ensureDocumentLimit, ensureStorageLimit test suites)
7. Fix org schema `currency` default from `"BRL"` to `"USD"`
8. Cancel/migrate the 10 sandbox subscriptions to new Free product

### Phase 1: Subscription System Foundation

1. Add `"enterprise"` to `TIER_NAMES`, add enterprise detection to `getSubscriptionPlan()`
2. Rewrite `PLAN_LIMITS` — no document/storage limits, just feature flags per tier:
   ```
   { free: { maxSeats: 1, templates: false, branding: false, api: false, webhooks: false, sso: false },
     pro: { maxSeats: 20, templates: true, branding: true, api: true, webhooks: true, sso: false },
     enterprise: { maxSeats: Infinity, templates: true, branding: true, api: true, webhooks: true, sso: true } }
   ```
3. Extend `use-subscription-limits.ts` hook: return `tier`, `isEnterprise`, and feature flags (`canCreateTemplates`, `canBrand`, `canUseAPI`, `canUseSSO`, `maxSeats`)
4. Create `getApplicationFee(db, organizationId)` — tier-aware fee calculation with card/ACH differentiation
5. Create `ensureSeatLimit(db, organizationId)` — counts active members vs tier max
6. Create `syncSeatCount(organizationId)` action — updates Stripe subscription quantity when members change

### Phase 2: Unlock Payments for Free Tier

7. Remove Pro gate from `settings/payments.tsx` — all tiers can connect Stripe
8. Replace `PLATFORM_FEE_RATES` in `payment_field_actions.ts` with tier-aware rates (4.5%+30¢ Free, 4%+30¢ Pro, custom Enterprise)
9. Add ACH rate handling (0.8% capped at $5) — needs payment method type detection at invoice creation
10. Handle the `application_fee_percent` → `application_fee_amount` migration for subscriptions (can't express 30¢ fixed as percentage)

### Phase 3: Add Missing Gates

11. Gate `updateBrandingSettings` and `generateLogoUploadUrl` with `ensureProFeature`
12. Add `isPro` check to `settings/branding.tsx` with upgrade CTA
13. Add seat limit checks to `addMember` and `createInvitation`
14. Wire `addMember`/`removeMember` to Stripe subscription quantity sync
15. Gate template creation UI (save-as-template dialog, document page button)
16. Add tier check to MCP server auth middleware
17. Add tier check to API middleware (`resolveApiAuth`)

### Phase 4: Downgrade Enforcement

18. Pre-downgrade validation in billing flow — block if seats > target tier limit
19. Suspend webhook deliveries on downgrade to Free (check tier before dispatch)
20. Suspend API key access on downgrade (check tier in `resolveApiAuth`)
21. Show "suspended" state UI for webhooks/API keys
22. Freeze branding on downgrade (persist config, stop applying, show "paused" with upgrade CTA)
23. Freeze templates on downgrade (read-only with lock icon)
24. Rewrite `sharing_cleanup.ts` — `downgradeUserSharing` → `downgradeOrgSharing(organizationId)`, same for `fullMemberRemovalCleanup`
25. Update `handleSubscriptionUpdated` — detect `past_due` status, show grace period banner
26. Wire `handleSubscriptionDeleted` to trigger full downgrade cascade (suspend webhooks/API, freeze templates/branding, downgrade sharing)

---

## Frontend UX Spec

### Principle

The product should feel complete at every tier, not like a crippled version begging to upgrade. Gated features are visible but softly locked. No banners, no pop-ups, no repeated CTAs.

### Shared Component: `<FeatureGate>`

One component used across all gated surfaces. Checks org tier, either renders children or renders a locked overlay.

```tsx
<FeatureGate
  tier="pro"
  feature="Custom branding"
  description="Add your logo and colors to signing pages."
>
  <BrandingSettingsForm />
</FeatureGate>
```

**Locked state renders:**

- A card at the top with lock icon, feature name, one-line description, and "Start free trial" button
- Children render below at `opacity-50 pointer-events-none` — user sees a preview of the feature but can't interact
- "Start free trial" links to billing page checkout flow

### Sidebar Navigation

All items visible regardless of tier. Pro-only sections (Branding, API Keys, Webhooks) show a small lock icon next to the label in `text-muted-foreground`. Clicking still navigates to the page — `<FeatureGate>` handles the rest.

### Gated Settings Pages

**Branding, API Keys, Webhooks, MCP:** Page loads normally. `<FeatureGate>` wraps the content. Locked state shows the single upgrade card + grayed-out preview of controls below.

**Template creation:** "Save as Template" button stays visible. On hover for Free users: tooltip "Available on Professional plan." No modal, no redirect.

**Team settings (seat limit):** Free users see themselves as the only member. "Invite" button disabled with tooltip: "Upgrade to invite team members."

### Billing Page (`settings/billing.tsx`)

The ONE place with a full tier comparison. Three cards:

```
┌─────────────┐  ┌──────────────────┐  ┌─────────────┐
│ Free        │  │ Professional     │  │ Enterprise  │
│ (Current)   │  │                  │  │             │
│             │  │ $19/seat/mo      │  │ Contact us  │
│ 1 seat      │  │ or $180/seat/yr  │  │             │
│ Unlimited   │  │                  │  │ 20+ seats   │
│ docs & sigs │  │ Everything in    │  │ SSO/SAML    │
│ Audit trail │  │ Free, plus:      │  │ Custom rates│
│ Payments    │  │ Templates        │  │             │
│ (4.5%+30¢)  │  │ Branding         │  │             │
│             │  │ API/MCP/Webhooks │  │             │
│             │  │ Up to 20 seats   │  │             │
│             │  │ Lower rates (4%) │  │             │
│             │  │                  │  │             │
│             │  │ [Start 14-day    │  │ [Contact    │
│             │  │  free trial]     │  │  sales]     │
└─────────────┘  └──────────────────┘  └─────────────┘
```

- No annual/monthly toggle on this page — that choice happens in Stripe Checkout after clicking "Start free trial"
- For Pro orgs: show current seat count, next billing date, payment method, and "Manage billing" (opens Stripe Portal for payment updates)
- Cancellation: "Cancel plan" button with multi-step confirmation that validates preconditions (seat count ≤ 1 for downgrade to Free)

### Dashboard / Home

No upgrade banners. No "you're on Free!" callouts. Dashboard feels like a complete product.

### One-Time Proactive Prompt

After 7+ days on Free AND 3+ documents created, show a single dismissable notification (toast or inbox-style): "Professional includes templates, custom branding, and API access. Try it free for 14 days." Shown once. Dismissable. Never again. Track dismissal in user metadata.

### Downgrade States

**Suspended webhooks/API keys:** Rows render with `opacity-50` and a "Suspended" badge (`Badge variant="outline"` in muted color). No delete buttons shown — keys are preserved for re-upgrade. The `<FeatureGate>` card appears at the top of the page.

**Frozen templates:** Template cards render with a lock overlay icon. Clicking shows tooltip: "Upgrade to Professional to use templates." Templates are not deleted — they're visually frozen.

**Paused branding:** Branding settings page shows current saved config at `opacity-50` with the `<FeatureGate>` card. Config is preserved — upgrading restores it immediately.

**Past-due (grace period):** A single warning bar at the top of the billing page only (not app-wide): "Your payment failed. Update your payment method to keep Professional features." Links to Stripe Portal for payment update. Not shown on any other page.

---

### Phase 5: Display + Polish

27. Update `settings/billing.tsx` — 3 tiers, correct features, seat count management, annual toggle, cancellation flow (validates preconditions)
28. Rewrite `pricing-block.tsx` on landing page — 3 tiers, correct features, "Start free trial" CTA
29. Rename all user-facing "Pro" → "Professional"
30. Add seat count display to team settings page
31. Add `past_due` banner on billing page with payment update CTA

---

## Key Files Reference

### Backend — Subscription System

| File                           | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `auth/subscription_guards.ts`  | Plan detection, limits, `ensureProFeature()` |
| `auth/subscription_helpers.ts` | `checkProFeature` internal query             |
| `stripe/pricing.ts`            | Tier names, lookup key parsing               |

### Backend — Features Needing Gates

| File                         | Functions                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `organizations/mutations.ts` | `updateBrandingSettings`, `generateLogoUploadUrl`, `addMember`, `createInvitation` |
| `stripe/connect_actions.ts`  | `createConnectedAccount`, `createAccountLink`                                      |

### Frontend — Settings Pages

| File                              | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `settings/payments.tsx`           | Stripe Connect setup (currently Pro-gated, needs unlocking) |
| `settings/branding.tsx`           | Custom branding (needs Pro gate)                            |
| `settings/billing.tsx`            | Plan display (needs 3-tier update)                          |
| `settings/team/index.tsx`         | Team management (needs seat limit display)                  |
| `settings/developer/api-keys.tsx` | API keys (correct)                                          |
| `settings/developer/webhooks.tsx` | Webhooks (correct)                                          |

### Frontend — Document Flow

| File                                    | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `documents/field-toolbar.tsx`           | Payment field button (correct once Connect unblocked) |
| `documents/save-as-template-dialog.tsx` | Template creation (needs Pro gate)                    |
| `$documentId.tsx`                       | "Save as Template" action (needs Pro gate)            |

### Landing Page

| File                                                | Purpose                                     |
| --------------------------------------------------- | ------------------------------------------- |
| `landing/src/components/sections/pricing-block.tsx` | Public pricing display (needs full rewrite) |

### MCP Server

| File                           | Purpose                            |
| ------------------------------ | ---------------------------------- |
| `apps/mcp-server/src/index.ts` | Auth middleware (needs tier check) |

---

## Edge Case Decisions

### Tier Transitions (Downgrade Scenarios)

#### Pro → Free with active payment fields on in-flight documents

**Stripe confirmation (2026-03-16):** `application_fee_amount` is immutable at PaymentIntent **creation** time — not at capture, not at confirmation. It cannot be updated even on unconfirmed intents in `requires_payment_method` status.

**Decision:** Defer PaymentIntent creation to the moment the recipient is ready to pay (after they load the signing page and interact with the payment field). Do NOT create the PaymentIntent when the document is sent.

**Implementation:**

- `getPaymentSecret` action (called when recipient opens payment field): creates the PaymentIntent at this point, using the org's **current** tier to calculate `application_fee_amount`
- If the org changes tiers between document send and recipient payment, the rate reflects the tier at payment time — this is the correct behavior since the org is paying the current rate for current service
- If a PaymentIntent already exists for this field (recipient revisiting), reuse it — don't create a new one
- Edge case: if recipient starts payment flow, abandons, org changes tier, recipient returns — the original PaymentIntent still has the old rate. Accept this as negligible risk (narrow window, small rate difference)

**Stripe also confirmed:** Express accounts support per-transaction `application_fee_amount` based on platform's internal tier logic. Platform Pricing Tool does NOT override transaction-specific fees. Express is the correct account type for Seal.

#### Pro → Free with >1 team member

**Decision:** Block the downgrade. User must manually remove members until they have 1 seat (the owner) before the system allows downgrade to Free.

**Implementation:** Before processing a subscription cancellation/downgrade:

1. Count active `organization_members` for the org
2. If count > target tier's seat limit, reject with: "You currently have {n} team members. Free plan supports 1 seat. Please remove {n-1} members before downgrading."
3. Pending invitations do NOT count toward the limit — they aren't members yet

#### Pro → Free with existing templates

**Decision:** Free users lose the ability to create new templates. Existing templates they created become read-only — they can view them but cannot use them to create new documents. They can still use templates explicitly shared with them by other orgs (if that feature exists), but their own templates are effectively frozen.

**Implementation:**

- `saveAsTemplate` mutation: already gated by `ensureProFeature()` — correct
- `createFromTemplate` mutation: add a check — if template was created by the org AND org is on Free tier, block with "Upgrade to Professional to use your templates"
- Templates page: show templates as read-only with a lock icon and upgrade CTA

#### Pro → Free with custom branding

**Decision:** Persist branding on already-sent documents (they're immutable snapshots). Strip branding from the org settings so new documents use Seal defaults. Don't delete the saved branding config — just stop applying it. If they upgrade again, their branding comes back.

**Implementation:**

- `updateBrandingSettings`: gated by `ensureProFeature()` (can't modify on Free)
- Document rendering: branding is already baked into sent documents at send time, so no retroactive change needed
- Signing page: if org is Free, ignore `brandingSettings` and use Seal defaults
- Settings UI: show current branding as "paused" with upgrade CTA, don't wipe the data

#### Pro → Free with active webhooks and API keys

**Decision:** Immediately stop all webhook deliveries and reject all API calls. Keys are not deleted — they're suspended. If the org upgrades again, they resume.

**Implementation:**

- Webhook dispatch: before sending, check org tier. If Free, skip delivery and log as "suspended"
- API middleware (`resolveApiAuth`): after validating the API key, check org's subscription tier. If Free, return 403 "API access requires a Professional plan"
- MCP server: same tier check in auth middleware
- Frontend: show webhooks/API keys as "suspended" with visual indicator, not deleted
- On upgrade: automatically resume — no user action needed

### Payment Flow

#### Stripe Connect architecture for Free users

**Decision:** All users (Free, Pro, Enterprise) create Stripe Connect accounts under Seal's platform. This is NOT "bring your own Stripe." Users go through Stripe Connect onboarding (KYC, bank account) via Seal's embedded onboarding flow. Their existing Stripe account can potentially be linked as a Standard connected account via OAuth, but the primary flow is creating a new Express/Custom connected account under Seal.

**Implementation:**

- Remove the "requires Pro plan" gate from `settings/payments.tsx`
- Connect onboarding flow stays the same — just available to all tiers
- Seal remains the platform account; user is always the connected account
- Support responsibility: Stripe handles payment disputes/chargebacks through the connected account. Seal handles platform-level issues.

#### Enterprise custom rates

**Decision:** Stored on the organization record in a `customPaymentRates` field. Set manually by Seal team (no self-service UI for enterprise rate configuration).

**Implementation:**

- Add `customPaymentRates?: { cardRate: number, cardFixed: number, achRate: number, achCap: number }` to organization schema
- `getApplicationFee()` helper checks: if enterprise AND `customPaymentRates` exists, use those. Otherwise fall back to tier defaults.
- Admin/superadmin mutation to set custom rates (internal tool only)

#### Rate change mid-document (upgrade/downgrade between send and payment)

**Decision:** Rate is locked at PaymentIntent creation time. Whatever tier the org was on when the PaymentIntent was created determines the `application_fee_amount`. Stripe does not allow modifying `application_fee_amount` after capture.

**Implementation:** No special handling needed. The fee is set once when `getPaymentSecret` creates the PaymentIntent. Subsequent tier changes don't affect existing intents.

### Seat Limits

#### Pending invitations and seat counting

**Decision:** Pending invitations do NOT count toward the seat limit. Only active `organization_members` with `status: "active"` count. Rationale: until someone accepts, they're not consuming resources or accessing the org.

**Implementation:** `ensureSeatLimit()` counts `organization_members` where `status === "active"` for the org. Compare against tier limit.

#### Owner as a seat

**Decision:** Yes, the owner counts as a seat. Free tier = 1 seat = the owner only. No additional members possible.

### API/MCP on Downgrade

#### API key created on Pro, org downgrades

**Decision:** Key stays in Clerk but is functionally dead. Every API request checks the org's current tier. If Free, return 403 regardless of valid key/scopes.

**Implementation:** Add tier check to `resolveApiAuth()` in `api/context.ts`, after key validation but before scope checking. This is a per-request check — no cron job needed to revoke keys.

#### MCP OAuth token on downgrade

**Decision:** Same as API keys. Token remains valid in Clerk's OAuth system, but the MCP server checks tier on every request. Free = 403.

**Implementation:** Add tier check in MCP auth middleware after Clerk OAuth validation.

### Structural Issues (must fix in Phase 0/1)

#### Subscriptions must be scoped to organization, not user

**Problem:** `subscriptions` table indexes by `by_user_id`. `getSubscriptionPlan()` takes `userId`. But a user can be in multiple orgs with different tiers. If User A owns Pro Org X and is a member of Free Org Y, calling `getSubscriptionPlan(userA)` returns Pro — even when they're operating in Org Y's context. Every feature gate would leak.

**Decision:** Subscription belongs to the organization. Stripe customer = organization, not user. `getSubscriptionPlan()` takes `organizationId`.

**Implementation:**

- Add `organizationId` to `subscriptions` schema (or replace `userId`)
- Create Stripe customer per org, not per user
- `getSubscriptionPlan(db, organizationId)` replaces `getSubscriptionPlan(db, userId)`
- All call sites updated: `ensureProFeature`, `ensureSeatLimit`, payment fee calculation, etc.
- Migration: existing sandbox subs are throwaway, so no data migration needed

#### Clerk webhook must enforce seat limits

**Problem:** `organizationMembership.created` webhook fires `upsertMembershipFromClerk` which creates member records with zero seat limit enforcement and zero Stripe quantity sync. An admin adding members via Clerk's dashboard bypasses all gates.

**Decision:** Enforce at the webhook level. If adding this member would exceed the seat limit, mark them as `suspended` instead of `active`.

**Implementation:**

- In `upsertMembershipFromClerk`: before creating/activating membership, count active members for the org
- If count >= tier max seats, set member status to `suspended` and log a warning
- After successful membership creation (if within limit), call `syncSeatCount()` action to update Stripe subscription quantity
- `organizationMembership.deleted` webhook must also call `syncSeatCount()` to decrement

#### Clerk SSO/SAML gating

**Clerk docs confirmed (2026-03-16):** Enterprise SSO is per-Organization via "Enterprise Connections" in the Clerk Dashboard. Connections are explicitly linked to a specific org. Clerk Backend API supports creating/deleting connections programmatically.

**Decision:** Gate at both the UI level and the Clerk API level.

**Implementation:**

- Don't expose SSO configuration UI to non-Enterprise orgs (hide the settings section)
- Use Clerk Backend API to programmatically create Enterprise Connections only for Enterprise-tier orgs
- If org downgrades from Enterprise: delete the Enterprise Connection via Clerk Backend API, which disables SSO
- Auth middleware fallback: if user authenticates via SAML/OIDC but org isn't Enterprise, reject session with upgrade message
- **JIT provisioning note:** Clerk auto-adds members when they authenticate via SSO (`organizationMembership.created` webhook). The seat limit enforcement in `upsertMembershipFromClerk` catches this. Enterprise tier has no hard seat cap (20+ = effectively unlimited, or custom max per deal).

### Payment Flow Additions

#### ACH = passthrough at cost, zero Seal margin

**Stripe confirmation (2026-03-16):** ACH rate 0.8% (cap $5) is Stripe's processing fee. Seal takes $0 application fee on ACH transactions.

**Implementation:**

- Card payments: `application_fee_amount` = tier-based (4.5% or 4%) \* amount + 30¢
- ACH payments: `application_fee_amount` = 0 (omit entirely)
- Payment method type must be detected at invoice creation to determine which fee to apply
- Use `allowedPaymentMethods` on the payment field config to determine if ACH is in play
- If both card and ACH are allowed, fee is set based on what the recipient actually uses — this means fee must be determined at payment confirmation, not invoice creation. **Research needed:** Can `application_fee_amount` be set on the PaymentIntent after the payment method is selected but before confirmation?

**Stripe confirmed (2026-03-16):** Deferred payment flow works — collect payment method first, determine fee, then create PaymentIntent. Application fees cannot be updated after creation, but they CAN be set correctly if you know the payment method type before creating the intent.

**Implementation — two-step approach:**

1. Recipient opens payment field → present payment method selection (card vs ACH)
2. After recipient selects method → create invoice with correct `application_fee_amount`:
   - Card: (4.5% or 4%) \* amount + 30¢
   - ACH: $0 (omit `application_fee_amount`)
3. This requires splitting the current `getPaymentSecret` flow into: (a) show payment options, (b) create invoice after selection

**Alternative (simpler but less clean):** Always set card-based `application_fee_amount`, then issue `application_fee_refund` if recipient pays via ACH. Avoids architectural change but adds reconciliation. Not recommended.

#### Ownership transfer

**Stripe confirmation:** Cannot change the customer on an existing subscription. Must cancel old + create new with trial bridge.

**Decision:** If subscription is scoped to org (not user), ownership transfer is just a Clerk role change. The org's Stripe customer and subscription don't change. The new owner inherits the existing billing relationship. **No Stripe action needed.**

### Failed Payment Grace Period

**Decision:** 7-day grace period with Stripe Smart Retries, then cancel.

**Configuration (Stripe Dashboard → Settings → Billing → Automatic collection):**

- Enable Smart Retries (ML-driven optimal retry timing)
- Max retry attempts: 4 (within 7 days)
- After retries exhausted: mark subscription as `canceled`
- Enable failed payment email to customer
- Enable card expiry email (pre-emptive)

**Implementation:**

- `handleSubscriptionUpdated`: when status changes to `past_due`, log warning but continue providing service (grace period)
- `handleSubscriptionDeleted` (or status → `canceled`): downgrade org to Free, trigger all downgrade enforcement (suspend webhooks/API, freeze templates/branding)
- Add `pastDue` visual indicator on billing page: "Your payment failed. Please update your payment method within 7 days to keep Professional features."
- Listen for `customer.subscription.trial_will_end` to send pre-trial-end reminders (for the 14-day trial)

### Enterprise Custom Rate Changes

**Decision:** When Seal admin changes custom rates for an enterprise org, show a warning listing how many in-flight PaymentIntents exist at the old rate. Rates only apply to new PaymentIntents — existing ones are immutable.

**Implementation:**

- Admin tool: before saving new rates, query `payment_field_configs` with `paymentStatus: "awaiting"` for the org
- Display: "X payments are in-flight at the current rate. New rates will only apply to future payments."
- No blocking — admin can still save, it's just informational

### Resolved Decisions (2026-03-16, final review)

#### Portal cancellation handling

**Decision:** Disable self-service cancellation in Stripe Customer Portal. Handle all cancellations through Seal's own UI, where we can validate seat count and other preconditions before processing.

**Implementation:**

- Configure portal via Stripe API: `stripe.billingPortal.configurations.create({ features: { subscription_cancel: { enabled: false } } })`
- Portal still available for: updating payment method, viewing invoices, updating billing info
- Cancellation/downgrade flow lives in `settings/billing.tsx` — validates preconditions (seat count ≤ target limit), then calls our backend action which cancels the Stripe subscription
- This is the safest approach — we control the cancel flow end-to-end

#### Stripe customer moves to organization

**Decision:** Kill `users.stripeCustomerId`. Replace with `organizations.stripeCustomerId`. Each org has its own Stripe customer. Users don't need one.

**Cleanup required — files referencing `user.stripeCustomerId`:**

- `schemas/users.ts:35` — remove field
- `stripe/actions.ts:123,194,262,267` — checkout/portal sessions: use org's customer ID
- `stripe/subscription_actions.ts:204-205` — `getOrCreateCustomerId`: rewrite for org
- `stripe/sync_subscriptions.ts:56,68,115,162,178` — sync logic: rewrite for org
- `stripe/handlers.ts:312-314` — `resolveUserForSubscription` Strategy 2 looks up user by `stripeCustomerId`: replace with org lookup
- `sync_external_data.ts:171,226` — external sync: update
- `stripe/backfill_subscriptions.ts` — entire file may need rewrite or deletion (was user-based backfill)

**New field:** `organizations` schema gets `stripeCustomerId: v.optional(v.string())`

#### Checkout quantity = org member count

**Decision:** `createCheckoutSession` and `createEmbeddedCheckoutSession` pass `quantity: activeOrgMemberCount` instead of `1`.

**Implementation:**

- Before creating checkout session, count active `organization_members` for the org
- Pass count as `quantity` in `line_items`
- Checkout shows `{count} × $19/mo = ${count * 19}/mo`

#### downgradeUserSharing → org-scoped

**Decision:** `handleSubscriptionDeleted` triggers `downgradeOrgSharing({ organizationId })` instead of `downgradeUserSharing({ userId })`.

**Implementation:**

- Rewrite `documents/sharing_cleanup.ts` to accept `organizationId`
- Only affect documents owned by the org, not the user's personal docs in other orgs

#### Auto-enrollment moves to org level

**Decision:** Keep auto-enrollment but move from user-level to org-level. Every org gets a Free Stripe subscription on creation. The subscription is the source of truth for tier + seat count. Stripe customer per org is required for Connect relationship tracking.

**However:** No credit card required at Free tier. Card is only collected when user starts the 14-day Pro trial ("Start free trial" → Stripe Checkout with `trial_period_days: 14`). This maximizes Free-tier adoption (no signup friction) while ensuring card is on file before any charges.

**Flow:**

1. Org created → Stripe customer created (no card) → Free subscription ($0/mo, quantity: 1)
2. User clicks "Start free trial" → Stripe Checkout collects card → Pro subscription with 14-day trial
3. Trial ends → card charged $19/seat/mo (or $180/seat/year if annual selected)
4. User cancels during trial → falls back to Free subscription, no charge

#### Promo codes schema

**Note:** `subscription_promo_codes.stripeCustomerId` — this is a Stripe-level restriction field (which customer can use a code). If we remove user-level customers, promo code restrictions would need to reference org-level customer IDs. Low priority — promo codes aren't in the current pricing rollout.
