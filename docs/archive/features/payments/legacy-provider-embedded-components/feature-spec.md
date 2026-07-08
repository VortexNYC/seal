# retired provider Embedded Components — Research & Implementation Framework

> **Status**: Decisions Finalized — Ready for Implementation
> **Last Updated**: 2026-02-19
> **Related Tickets**: TBD

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Decisions](#decisions)
3. [Competitor Analysis: PandaDoc](#competitor-analysis-pandadoc)
4. [Current Seal retired provider Architecture](#current-seal-retired_provider-architecture)
5. [retired provider Component Families](#retired_provider-component-families)
   - [Family 1: Connect Embedded Components](#family-1-connect-embedded-components)
   - [Family 2: retired provider Elements](#family-2-retired_provider-elements)
   - [Family 3: Embedded Checkout](#family-3-embedded-checkout)
   - [Family 4: Pricing Table & Buy Button](#family-4-pricing-table--buy-button)
6. [Codebase Mapping](#codebase-mapping)
7. [Implementation Framework](#implementation-framework)
8. [Priority Matrix](#priority-matrix)
9. [Technical Requirements](#technical-requirements)
10. [Data Loading Architecture](#data-loading-architecture)
11. [Implementation Notes](#implementation-notes)
12. [Standard Account Compatibility](#standard-account-compatibility)

---

## Executive Summary

Seal's current retired provider integration is **entirely redirect-based** — every retired provider interaction (checkout, billing portal, Connect onboarding, payment collection) navigates users away from the app to retired provider-hosted pages and back. retired provider offers **four families of embeddable React components** that can replace these redirects with inline experiences, improving UX and reducing drop-off.

This document catalogs **every available retired provider embedded component**, maps each against Seal's current architecture, and provides a framework for prioritizing implementation.

### Key Numbers

| Family                      | Package                                       | Total Components     | Relevant to Seal |
| --------------------------- | --------------------------------------------- | -------------------- | ---------------- |
| Connect Embedded Components | `@retired_provider/react-connect-js`          | 35                   | ~8               |
| retired provider Elements   | `@retired_provider/react-retired_provider-js` | 7                    | ~3               |
| Embedded Checkout           | `@retired_provider/react-retired_provider-js` | 1 (provider pattern) | 1                |
| Pricing Table / Buy Button  | Web components (no React pkg)                 | 2                    | 1                |

---

## Decisions

All open questions have been resolved. These are the finalized architectural decisions.

### Decision 1: Sign-then-Pay (PandaDoc Model)

**Decision**: Signers complete their signature FIRST, then pay inline immediately after.

**Flow**:

1. Signer opens document, fills all fields, submits signature
2. If payment fields exist → document status becomes **"Waiting for payment"**
3. Inline `<PaymentElement />` appears immediately after signature submission
4. Signer pays without leaving Seal (no redirect)
5. Payment confirmed → document status → **"Completed"**
6. If signer closes before paying → status stays "Waiting for payment", they can return via their signing link to complete payment

**Rationale** (informed by [PandaDoc competitor analysis](#competitor-analysis-pandadoc)):

- **Lower friction at the critical moment** — the signature is the hardest psychological step. Adding a payment wall before it increases drop-off.
- **Legal enforceability** — a signed document creates legal obligation to pay. If they sign but don't pay, you have a signed contract to enforce. If they don't sign at all (because they bounced at the payment wall), you have nothing.
- **Higher conversion** — get the signature first while intent is high, then collect payment immediately after while they're still engaged.
- **Simpler edge cases** — no need to handle "paid but didn't sign" refund scenarios.

### Decision 2: Keep Invoices, Expose Invoice's client_secret

**Decision**: Keep the entire invoice-based payment architecture. Only add ~3 lines of code to expose the invoice's underlying PaymentIntent `client_secret` to the frontend.

**What does NOT change** (zero modifications):

- Invoice creation logic — all 4 payment types (one_time, recurring, installments, deposit_balance) stay exactly as-is
- Line item creation — stays as-is
- Recurring subscriptions via `retired_provider.subscriptions.create()` — stays as-is
- Installments via Subscription Schedules — stays as-is
- Deposit + balance dual invoices — stays as-is
- Webhook handling (`invoice.paid`, `invoice.payment_failed`) — stays as-is
- Platform fee calculation — stays as-is
- The `payment_field_configs` schema — stays as-is

**What DOES change** (one small addition):

When retired provider finalizes an invoice, it automatically creates a PaymentIntent under the hood. That PaymentIntent has a `client_secret`. We expose it:

```typescript
// CURRENT (payment_field_actions.ts, line ~194)
const finalizedInvoice = await retired_provider.invoices.finalizeInvoice(invoice.id, ...);
return { hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url };
// ↑ Signer clicks URL → leaves Seal → pays on retired provider's hosted page

// NEW (add ~3 lines)
const finalizedInvoice = await retired_provider.invoices.finalizeInvoice(invoice.id, ...);
const paymentIntent = await retired_provider.paymentIntents.retrieve(
  finalizedInvoice.payment_intent as string,
  { retired_providerAccount: retired_providerAccountId }
);
return {
  hostedInvoiceUrl: finalizedInvoice.hosted_invoice_url, // ← KEEP for email links
  clientSecret: paymentIntent.client_secret,              // ← NEW for inline PaymentElement
};
```

The `hosted_invoice_url` stays — it's still used in notification emails ("Pay Now" link). But when the signer is ON the signing page, they see the inline `<PaymentElement />` instead.

**Key insight**: We're not switching FROM invoices TO PaymentIntents. We're reaching INTO the invoice to grab the payment handle that retired provider already created, so we can render the payment form inline instead of redirecting.

**Caveat for recurring/installments**: Only the first invoice can be embedded on the signing page. Subsequent invoices (month 2, 3, etc.) are collected via the saved payment method from the first payment, or via the hosted invoice URL in retired provider's email.

### Decision 3: Keep Custom Pricing Cards + Embedded Checkout

**Decision**: Keep the current custom pricing card design on the billing page. Only replace the retired provider Checkout redirect with an inline Embedded Checkout.

**What stays**: The two-column Free/Pro layout, feature lists, status badges, custom formatting.

**What changes**: When user clicks "Upgrade to Pro", instead of `window.location.href = url` (redirect to retired provider), render `<CheckoutProvider>` inline. User sees the checkout form, pays, and gets returned — all without leaving the app.

**Pricing Table rejected** because: can't style to match Seal's design system, no Connect support, loses the two-column comparison layout.

### Decision 4: Keep Customer Portal Redirect

**Decision**: Keep the redirect-based Customer Portal for subscription management (cancel, change plan, update payment method).

No embedded replacement exists from retired provider. Not worth building custom subscription management UI. The "Manage Billing" button stays as a redirect.

### Decision 5: Add `waiting_for_payment` Workflow Status

**Decision**: Add `waiting_for_payment` as an explicit status in `documentWorkflowStatusTuple`.

**Updated state machine**:

```
draft → sent → in_progress → waiting_for_payment → completed
                    ↓
                declined
     ↓
  cancelled
```

A document enters `waiting_for_payment` when all signatures are collected but payment fields exist and haven't been paid. This is a first-class status — visible in dashboard filters, document lists, and status badges. It communicates clearly to the sender: "your document is signed, payment is pending."

### Decision 6: All-Sign-then-Pay (PandaDoc Model for Multi-Party)

**Decision**: Payment is gated behind **all parties signing**. One designated payer per document.

**Flow with multiple signers** (informed by [PandaDoc](#competitor-analysis-pandadoc)):

1. Signer A signs → document stays `in_progress`
2. Signer B signs → document stays `in_progress`
3. Signer C (who has the payment field) signs → all signatures complete → document enters `waiting_for_payment`
4. Signer C sees inline `<PaymentElement />` immediately after their signature
5. Payment confirmed → document status → `completed`

**Why all-sign-then-pay** (not pay-on-individual-sign):

- PandaDoc requires all parties to sign before payment is available — proven pattern
- Legally stronger: all parties have agreed to the terms before money changes hands
- Avoids the edge case of "paid but another party declined to sign" (would require refund)

**One payer per document**: PandaDoc uses singular "the payer" language. Seal follows this — one recipient is assigned the payment field. Other signers only see signature fields.

### Decision 7: Document as Financial Hub

**Decision**: Each document's detail page serves as a complete financial view of all linked invoices and payments.

**Vision**: A contract is like a project. The document detail page shows everything — signatures, fields, AND all financial data in one clean view:

| Section               | What It Shows                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Payment Status**    | Current status badge: Unpaid / Waiting / Paid / Overdue / Partial                                                       |
| **Invoices**          | All retired provider invoices linked to this document (one-time, deposit, balance, recurring) with status, amount, date |
| **Payment Timeline**  | Chronological feed: "Invoice created → Payment attempted → Payment succeeded"                                           |
| **Upcoming Payments** | For recurring/installments: next invoice date, remaining installments                                                   |

This data comes from two sources:

- **Convex** (`payment_field_configs` table) — stores retired provider invoice IDs, payment status, amounts
- **retired provider** (via API or webhooks) — real-time invoice/payment status synced via existing webhook handlers

**For the sender**: The document detail page is the single place to see "is this contract paid?" without leaving Seal or checking retired provider Dashboard.

**For high-level overview**: The [Phase 4 stats pages](#phase-4-connect-account-dashboard-retired_provider-stats-section) (`settings/payment-history`, `settings/payouts`, etc.) show aggregate payment data across all documents.

### Decision Summary

| Question                   | Decision                                    | Key Rationale                                                    |
| -------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Payment timing             | **Sign-then-pay**                           | Lower friction, higher conversion, legal standing from signature |
| Invoice vs PaymentIntent   | **Keep invoices**, expose `client_secret`   | Zero rewrite, ~3 lines of new backend code                       |
| Pricing UI                 | **Keep custom cards** + Embedded Checkout   | Current design is strong, just replace the redirect step         |
| Customer Portal            | **Keep redirect**                           | No embedded replacement exists                                   |
| Standard account compat    | **Confirmed** — all account types supported | [See details](#standard-account-compatibility)                   |
| Workflow status            | **Add `waiting_for_payment`**               | Explicit status for signed-but-unpaid documents                  |
| Multi-party payment timing | **All-sign-then-pay**                       | All sign first, then payer pays (PandaDoc model)                 |
| Financial data display     | **Document as financial hub**               | Document detail page shows all invoices, payments, timeline      |

---

## Competitor Analysis: PandaDoc

PandaDoc is the leading e-signature competitor when it comes to integrated payments. Their approach directly informed our sign-then-pay decision.

### PandaDoc Payment Flow (Recipient Perspective)

1. Recipient opens document, fills required fields, signs
2. Document status changes to **"Waiting for payment"**
3. A **"Pay"** button appears at the top of the finalized document
4. Recipient clicks Pay → **inline payment form** appears (embedded, not a redirect)
5. Recipient selects payment method: credit card, ACH/bank transfer, or PayPal
6. After successful payment → document status becomes **"Paid"**
7. Both parties receive confirmation emails

### Key Design Choices

| Aspect              | PandaDoc Approach                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Payment timing**  | After ALL parties sign and finalize — payment gated behind signature completion                                          |
| **Payment UI**      | Embedded inline within the document viewer (no redirect for card/ACH; PayPal redirects to PayPal auth)                   |
| **Payment methods** | Credit card, ACH/bank transfer, PayPal, digital wallets, Klarna, SEPA (all methods enabled in retired provider settings) |
| **Gating**          | All parties must sign before payment becomes available                                                                   |
| **Platform fee**    | $0 PandaDoc fee (retired provider processing fee still applies)                                                          |
| **Limitations**     | Minimum charge $0.50; one retired provider account per workspace                                                         |
| **NOT supported**   | Real-time payments, cash vouchers, bank transfers (push), BNPL                                                           |

### How Seal Will Differ from PandaDoc

| Aspect               | PandaDoc                           | Seal                                                   |
| -------------------- | ---------------------------------- | ------------------------------------------------------ |
| Payment types        | One-time, recurring                | One-time, recurring, installments, deposit + balance   |
| Payment architecture | retired provider Checkout (likely) | Invoice-based with PaymentElement (more control)       |
| Platform fees        | $0                                 | 1% free / 0.25% Pro (configurable absorb/pass-through) |
| Fee handling         | Fixed                              | Sender chooses: absorb or pass to recipient            |
| Multi-account        | One retired provider per workspace | One retired provider Connect account per org           |

### Sources

- [PandaDoc Payments - Recipient's Guide](https://support.pandadoc.com/en/articles/9714761-pandadoc-payments-recipient-s-guide)
- [retired provider Checkout Payments in PandaDoc](https://support.pandadoc.com/en/articles/9714942-retired_provider-checkout-payments)
- [PandaDoc Payments Overview](https://www.pandadoc.com/payments/)
- [PandaDoc retired provider Integration](https://www.pandadoc.com/integrations/payment/retired_provider/)

---

## Current Seal retired provider Architecture

### Backend Actions (`apps/backend/convex/retired_provider/`)

| File                       | Action                        | What It Does                                                              | Redirect?                                          |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `actions.ts`               | `createCheckoutSession`       | Creates `retired_provider.checkout.sessions.create()`, returns URL        | **Yes** — redirects to retired provider Checkout   |
| `actions.ts`               | `createCustomerPortalSession` | Creates `retired_provider.billingPortal.sessions.create()`, returns URL   | **Yes** — redirects to retired provider Portal     |
| `connect_actions.ts`       | `createConnectedAccount`      | Creates Standard Connect account via `retired_provider.accounts.create()` | No (API only)                                      |
| `connect_actions.ts`       | `createAccountLink`           | Creates `retired_provider.accountLinks.create()` for hosted onboarding    | **Yes** — redirects to retired provider onboarding |
| `connect_actions.ts`       | `createConnectOAuthUrl`       | Generates OAuth authorize URL                                             | **Yes** — redirects to retired provider OAuth      |
| `connect_actions.ts`       | `exchangeConnectOAuthCode`    | Handles OAuth code exchange                                               | No (API only)                                      |
| `connect_actions.ts`       | `refreshConnectedAccount`     | Refreshes account status from retired provider                            | No (API only)                                      |
| `payment_field_actions.ts` | Various                       | Creates invoices/subscriptions for payment fields                         | **Yes** — hosted invoice URLs in email             |

### Frontend Pages

| File                    | Page                                | Current UX                                                                                           |
| ----------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `settings/billing.tsx`  | Subscription billing                | Custom pricing cards → redirect to retired provider Checkout; "Manage" → redirect to Customer Portal |
| `settings/payments.tsx` | retired provider Connect onboarding | Status display → redirect to Account Link for onboarding; OAuth flow for connection                  |
| Signing page            | Payment collection                  | Recipient clicks hosted invoice URL in email → retired provider-hosted payment page                  |

### Webhook Handlers

| Event                                     | Handler                      |
| ----------------------------------------- | ---------------------------- |
| `checkout.session.completed`              | Activates subscription       |
| `invoice.paid` / `invoice.payment_failed` | Updates payment field status |
| `customer.subscription.updated/deleted`   | Syncs subscription state     |
| `account.updated`                         | Syncs Connect account status |

---

## retired provider Component Families

### Family 1: Connect Embedded Components

**Packages**: `@retired_provider/connect-js` + `@retired_provider/react-connect-js`

**Architecture**: Server creates an `AccountSession` via `retired_provider.accountSessions.create()` → returns `client_secret` → client uses `ConnectComponentsProvider` to power all components.

```typescript
// Backend: New action needed
const accountSession = await retired_provider.accountSessions.create({
  account: connectedAccountId,
  components: {
    account_onboarding: { enabled: true },
    account_management: { enabled: true },
    // ... enable specific components
  },
});
return accountSession.client_secret;

// Frontend: Provider setup
import { ConnectComponentsProvider } from "@retired_provider/react-connect-js";
import { loadConnectAndInitialize } from "@retired_provider/connect-js";

const retired_providerConnect = loadConnectAndInitialize({
  publishableKey: "pk_...",
  fetchClientSecret: async () => {
    // Call your backend to create AccountSession
    return clientSecret;
  },
});

<ConnectComponentsProvider connectInstance={retired_providerConnect}>
  <ConnectAccountOnboarding />
</ConnectComponentsProvider>
```

#### Complete Component Catalog

##### Onboarding & Compliance (3 components)

| Component               | React Element                   | Status | Description                                                                                        |
| ----------------------- | ------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| **Account Onboarding**  | `<ConnectAccountOnboarding />`  | GA     | Full onboarding flow — replaces Account Links redirect. Collects identity, business info, banking. |
| **Account Management**  | `<ConnectAccountManagement />`  | GA     | Post-onboarding account settings — update business info, banking, identity.                        |
| **Notification Banner** | `<ConnectNotificationBanner />` | GA     | Shows actionable alerts (e.g., "verification required") with inline resolution.                    |

##### Payments (5 components)

| Component                   | React Element                      | Status  | Description                                                 |
| --------------------------- | ---------------------------------- | ------- | ----------------------------------------------------------- |
| **Payments**                | `<ConnectPayments />`              | GA      | Payments list/table for a connected account.                |
| **Payment Details**         | `<ConnectPaymentDetails />`        | GA      | Detail view of a single payment — timeline, refund actions. |
| **Disputes for a Payment**  | `<ConnectDisputesForPayment />`    | GA      | Disputes associated with a specific payment.                |
| **Disputes List**           | `<ConnectDisputesList />`          | GA      | All disputes for the connected account.                     |
| **Payment Method Settings** | `<ConnectPaymentMethodSettings />` | Preview | Configure accepted payment methods.                         |

##### Payouts (5 components)

| Component                     | React Element                        | Status | Description                                           |
| ----------------------------- | ------------------------------------ | ------ | ----------------------------------------------------- |
| **Payouts**                   | `<ConnectPayouts />`                 | GA     | Payouts overview — balance + recent payouts.          |
| **Balances**                  | `<ConnectBalances />`                | GA     | Account balance breakdown (available, pending).       |
| **Payouts List**              | `<ConnectPayoutsList />`             | GA     | Full payout history table.                            |
| **Payout Details**            | `<ConnectPayoutDetails />`           | GA     | Detail view of a single payout with transaction list. |
| **Instant Payouts Promotion** | `<ConnectInstantPayoutsPromotion />` | GA     | CTA to enable instant payouts if eligible.            |

##### Capital (3 components)

| Component                         | React Element                            | Status  | Description                                   |
| --------------------------------- | ---------------------------------------- | ------- | --------------------------------------------- |
| **Capital Financing Application** | `<ConnectCapitalFinancingApplication />` | Preview | Apply for retired provider Capital financing. |
| **Capital Financing Promotion**   | `<ConnectCapitalFinancingPromotion />`   | Preview | Promotional banner for Capital offers.        |
| **Capital Financing**             | `<ConnectCapitalFinancing />`            | Preview | Overview of active Capital financing.         |

##### Tax (5 components)

| Component                     | React Element                       | Status  | Description                               |
| ----------------------------- | ----------------------------------- | ------- | ----------------------------------------- |
| **Tax Registrations**         | `<ConnectTaxRegistrations />`       | GA      | Manage tax registrations by jurisdiction. |
| **Tax Settings**              | `<ConnectTaxSettings />`            | GA      | Configure tax calculation settings.       |
| **Export Tax Transactions**   | `<ConnectExportTaxTransactions />`  | Preview | Export tax transaction data.              |
| **Tax Threshold Monitoring**  | `<ConnectTaxThresholdMonitoring />` | Preview | Monitor tax thresholds by region.         |
| **Product Tax Code Selector** | `<ConnectProductTaxCodeSelector />` | Preview | Select tax codes for products.            |

##### Financial Services (4 components)

| Component                          | React Element                             | Status | Description                                |
| ---------------------------------- | ----------------------------------------- | ------ | ------------------------------------------ |
| **Financial Account**              | `<ConnectFinancialAccount />`             | GA     | Treasury financial account overview.       |
| **Financial Account Transactions** | `<ConnectFinancialAccountTransactions />` | GA     | Transaction history for financial account. |
| **Issuing Card**                   | `<ConnectIssuingCard />`                  | GA     | Display/manage a single issued card.       |
| **Issuing Cards List**             | `<ConnectIssuingCardsList />`             | GA     | List all issued cards.                     |

##### Reporting (2 components)

| Component           | React Element               | Status  | Description                               |
| ------------------- | --------------------------- | ------- | ----------------------------------------- |
| **Documents**       | `<ConnectDocuments />`      | GA      | Tax documents, 1099s, account statements. |
| **Reporting Chart** | `<ConnectReportingChart />` | Preview | Embedded analytics/reporting charts.      |

##### Apps (2 components)

| Component        | React Element            | Status  | Description                                             |
| ---------------- | ------------------------ | ------- | ------------------------------------------------------- |
| **App Install**  | `<ConnectAppInstall />`  | Preview | Install retired provider Apps into a connected account. |
| **App Viewport** | `<ConnectAppViewport />` | Preview | Render a retired provider App within your platform UI.  |

---

### Family 2: retired provider Elements

**Packages**: `@retired_provider/retired_provider-js` + `@retired_provider/react-retired_provider-js`

**Architecture**: Server creates a PaymentIntent or SetupIntent → returns `client_secret` → client uses `Elements` provider to render payment UI.

```typescript
// Frontend setup
import { Elements } from "@retired_provider/react-retired_provider-js";
import { loadretired provider } from "@retired_provider/retired_provider-js";

const retired_providerPromise = loadretired provider("pk_...");

<Elements retired_provider={retired_providerPromise} options={{ clientSecret }}>
  <PaymentElement />
</Elements>
```

#### Complete Elements Catalog

| Element                              | React Component                     | Description                                                                                               | Use Case                                                     |
| ------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Payment Element**                  | `<PaymentElement />`                | Unified payment method selector — cards, wallets, bank transfers, BNPL. Auto-adapts to customer location. | **Primary** — replaces hosted invoice for payment collection |
| **Express Checkout Element**         | `<ExpressCheckoutElement />`        | One-click checkout buttons — Apple Pay, Google Pay, Link.                                                 | Fast payment for returning users                             |
| **Link Authentication Element**      | `<LinkAuthenticationElement />`     | Email input that auto-detects retired provider Link users for 1-click pay.                                | Pre-auth for payment flows                                   |
| **Address Element**                  | `<AddressElement />`                | Smart address form with autocomplete, validation, formatting per country.                                 | Billing/shipping address collection                          |
| **Payment Method Messaging Element** | `<PaymentMethodMessagingElement />` | "Pay in 4 with Afterpay" or "Pay with Klarna" messaging banners.                                          | BNPL promotion on pricing pages                              |
| **Currency Selector Element**        | `<CurrencySelectorElement />`       | Currency picker for multi-currency payments.                                                              | International payment flows                                  |
| **Tax ID Element**                   | `<TaxIdElement />`                  | Tax ID input with country-specific formatting/validation.                                                 | B2B invoicing                                                |

---

### Family 3: Embedded Checkout

**Package**: `@retired_provider/react-retired_provider-js` (sub-path `@retired_provider/react-retired_provider-js/checkout`)

**Architecture**: Server creates a Checkout Session with `ui_mode: "embedded"` → returns `client_secret` → client renders full checkout inline.

```typescript
// Backend: Modify existing createCheckoutSession
const session = await retired_provider.checkout.sessions.create({
  ui_mode: "embedded", // KEY CHANGE — was "hosted"
  line_items: [...],
  return_url: "https://seal.app/settings/billing?session_id={CHECKOUT_SESSION_ID}",
  // ... same as current but no success_url/cancel_url
});
return session.client_secret; // Return secret, not URL

// Frontend
import { CheckoutProvider, useCheckout } from "@retired_provider/react-retired_provider-js/checkout";

<CheckoutProvider retired_provider={retired_providerPromise} options={{ clientSecret }}>
  <EmbeddedCheckout />
  {/* Or build custom UI with useCheckout() hook */}
</CheckoutProvider>
```

**Key difference from current**: Instead of redirecting to `session.url`, you render the checkout inline. The `return_url` is used after payment completes (replaces `success_url`).

---

### Family 4: Pricing Table & Buy Button

**No React package** — these are web components (`<retired_provider-pricing-table>`, `<retired_provider-buy-button>`) configured entirely in the retired provider Dashboard.

```html
<!-- Pricing Table -->
<script async src="https://js.retired_provider.com/v3/pricing-table.js"></script>
<retired_provider-pricing-table
  pricing-table-id="prctbl_..."
  publishable-key="pk_..."
  customer-email="user@example.com"
/>

<!-- Buy Button -->
<script async src="https://js.retired_provider.com/v3/buy-button.js"></script>
<retired_provider-buy-button buy-button-id="buy_btn_..." publishable-key="pk_..." />
```

**Important limitation**: Pricing Table does **NOT** support retired provider Connect (cannot attribute to connected accounts). It only works for direct charges on the platform account.

| Component         | Type          | Description                                    | Connect Support |
| ----------------- | ------------- | ---------------------------------------------- | --------------- |
| **Pricing Table** | Web component | No-code pricing display with built-in checkout | **No**          |
| **Buy Button**    | Web component | Single-product purchase button                 | **No**          |

---

## Codebase Mapping

This section maps each current redirect-based flow to its embedded component replacement.

### Map 1: Connect Onboarding (settings/payments.tsx)

| Current Flow                                                         | Embedded Replacement                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `createAccountLink` → redirect to retired provider-hosted onboarding | `<ConnectAccountOnboarding />` — inline onboarding                |
| `createConnectOAuthUrl` → redirect to OAuth                          | Can be replaced entirely by Account Onboarding component          |
| Custom status display + "Continue Setup" button                      | `<ConnectNotificationBanner />` — auto-shows pending requirements |
| No post-onboarding account management                                | `<ConnectAccountManagement />` — inline account settings          |

**Backend changes needed**:

- New action: `createAccountSession` in `connect_actions.ts` — calls `retired_provider.accountSessions.create()` with enabled components
- Keep existing actions for fallback/migration

**Frontend changes needed**:

- Install `@retired_provider/connect-js` + `@retired_provider/react-connect-js`
- Refactor `payments.tsx` to use `ConnectComponentsProvider`
- Replace redirect flow with `<ConnectAccountOnboarding />`
- Add `<ConnectNotificationBanner />` for ongoing requirements
- Add `<ConnectAccountManagement />` for post-onboarding settings

**Files affected**:

- `apps/backend/convex/retired_provider/connect_actions.ts` — add `createAccountSession`
- `apps/web/src/routes/_authenticated/$slug/settings/payments.tsx` — full refactor
- `apps/web/package.json` — add `@retired_provider/connect-js`, `@retired_provider/react-connect-js`

### Map 2: Subscription Billing (settings/billing.tsx)

**Decision**: Keep custom pricing cards + Embedded Checkout. Customer Portal stays redirect-based.

| Current Flow                                                                           | Embedded Replacement                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Custom pricing cards → `createCheckoutSession` → redirect to retired provider Checkout | Keep custom cards → Embedded Checkout with `ui_mode: "embedded"` (inline) |
| "Manage Subscription" → `createCustomerPortalSession` → redirect to Portal             | **No change** — Customer Portal stays redirect-based                      |

**Backend changes needed**:

- New action `createEmbeddedCheckoutSession` in `actions.ts` — same as current `createCheckoutSession` but with `ui_mode: "embedded"` and returns `client_secret` instead of URL
- Keep existing `createCheckoutSession` as-is (for any other checkout needs)

**Frontend changes needed**:

- Install `@retired_provider/retired_provider-js` + `@retired_provider/react-retired_provider-js`
- When user clicks "Upgrade to Pro", set `checkoutClientSecret` state instead of redirecting
- Conditionally render `<CheckoutProvider>` with inline checkout (dialog or expanded section)
- Handle return flow (session status check via `return_url`)

**Files affected**:

- `apps/backend/convex/retired_provider/actions.ts` — add `createEmbeddedCheckoutSession`
- `apps/web/src/routes/_authenticated/$slug/settings/billing.tsx` — replace redirect with inline checkout
- `apps/web/package.json` — add `@retired_provider/retired_provider-js`, `@retired_provider/react-retired_provider-js`

### Map 3: Payment Collection on Signing Page (Sign-then-Pay)

**Decision**: Sign-then-pay flow. Keep invoices, expose `client_secret` for inline `<PaymentElement />`.

| Current Flow                                                                                                  | Embedded Replacement                                                                   |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Backend creates retired provider invoice → `hosted_invoice_url` in email → recipient pays on retired provider | Invoice stays. Also return `client_secret` → `<PaymentElement />` inline after signing |
| Recipient leaves Seal entirely to pay                                                                         | Signer signs first → inline payment appears → pays without leaving                     |

**This is the highest-impact change** — recipients currently leave Seal to pay. The sign-then-pay flow with inline PaymentElement:

- Eliminates the redirect to retired provider's hosted invoice page
- Captures payment while intent is highest (immediately after signing)
- Keeps the entire signing + payment experience in-app
- Falls back to hosted invoice URL in email for signers who close before paying

**Backend changes needed** (~3 lines per payment type function):

- After `retired_provider.invoices.finalizeInvoice()`, retrieve the invoice's underlying PaymentIntent
- Return `paymentIntent.client_secret` alongside existing `hosted_invoice_url`
- Store `client_secret` on `payment_field_configs` for the signing page to query
- **Zero changes** to invoice creation, line items, subscriptions, webhooks, or fee logic

```typescript
// Add after finalizeInvoice in each payment type function:
const paymentIntent = await retired_provider.paymentIntents.retrieve(
  finalizedInvoice.payment_intent as string,
  { retired_providerAccount: retired_providerAccountId },
);
// Return both: hosted URL for email fallback, client_secret for inline payment
```

**Frontend changes needed**:

- After signature submission with payment fields: show inline `<PaymentElement />` instead of "Pay Now →" link
- Document status transitions: "in_progress" → (signature submitted) → "Waiting for payment" → (payment confirmed) → "Completed"
- `PaymentFieldSummary` component: replace external link with `<Elements>` + `<PaymentElement />`
- Handle payment confirmation and error states inline

**Files affected**:

- `apps/backend/convex/retired_provider/payment_field_actions.ts` — add `client_secret` retrieval (~3 lines per function)
- `apps/backend/convex/payment_fields/queries.ts` — new query to return `client_secret` for signing page
- `apps/web/src/components/documents/field-inputs/payment-field-summary.tsx` — replace "Pay Now" link with inline `<PaymentElement />`
- `apps/web/src/routes/sign.$token.tsx` — post-signature payment flow
- `apps/web/package.json` — add `@retired_provider/retired_provider-js`, `@retired_provider/react-retired_provider-js` (shared with Phase 2)

### Map 4: Connect Account Stats Pages (Phase 4)

No current equivalent in Seal. These are **net-new pages** using Connect embedded components to display retired provider-loaded account information. See [Data Loading Architecture](#data-loading-architecture) for the full rationale.

| Route                      | Component                                                    | What It Shows                                   |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| `settings/payment-history` | `<ConnectPayments />`                                        | Payment history for collected document payments |
| `settings/payouts`         | `<ConnectPayouts />`                                         | Payout schedule and history                     |
| `settings/balances`        | `<ConnectBalances />` + `<ConnectInstantPayoutsPromotion />` | Available/pending balance                       |
| `settings/disputes`        | `<ConnectDisputesList />`                                    | Payment disputes and chargebacks                |
| `settings/tax-documents`   | `<ConnectDocuments />`                                       | Tax forms (1099-K, etc.)                        |

**Conditional visibility**: These pages and their sidebar links only appear when the org has a connected retired provider account. Organizations that don't use retired provider Connect for payments never see them.

**Backend change needed**:

- New action: `createAccountSession` in `connect_actions.ts` — shared with Phase 1 onboarding (same action, different `components` list)

**Frontend changes needed**:

- Create `retired providerConnectProvider` component (shared with Phase 1)
- Create 5 new settings routes following the [Plasma portal pattern](#plasma-portal-pattern)
- Add conditional sidebar section with Connect page links

---

## Implementation Framework

### Phase 1: Connect Onboarding (Highest Confidence)

**Goal**: Replace redirect-based Connect onboarding with inline experience.

**Why first**:

- Direct replacement of existing flow — no new business logic
- retired provider confirms embedded components support all account types including Standard
- Eliminates the most jarring redirect (leaving app during setup)
- `<ConnectNotificationBanner />` replaces our custom requirements summary

**Scope**:

1. Install `@retired_provider/connect-js` + `@retired_provider/react-connect-js`
2. Create `createAccountSession` action in `connect_actions.ts`
3. Create `retired providerConnectProvider` component in `integrations/retired_provider/`
4. Refactor `settings/payments.tsx`:
   - Replace `handleConnectNewAccount` (Account Links redirect) with `<ConnectAccountOnboarding />`
   - Remove OAuth flow entirely
   - Replace requirements summary with `<ConnectNotificationBanner />`
   - Add `<ConnectAccountManagement />` for post-onboarding settings (replaces "Manage in retired provider" external link)

**Estimated complexity**: Medium — one new backend action + frontend refactor.

### Phase 2: Embedded Checkout for Subscriptions

**Goal**: Replace retired provider Checkout redirect with inline checkout on billing page.

**Why second**:

- Clear before/after — same flow, just embedded
- Keeps our custom pricing card design (which is strong)
- Only changes the checkout step, not the pricing UI

**Scope**:

1. Install `@retired_provider/retired_provider-js` + `@retired_provider/react-retired_provider-js`
2. Add `createEmbeddedCheckoutSession` action (same as current but `ui_mode: "embedded"`, returns `client_secret`)
3. In `billing.tsx`: "Upgrade to Pro" sets `checkoutClientSecret` state → renders `<CheckoutProvider>` inline (dialog or expanded section)
4. Handle `return_url` flow for post-payment redirect
5. Customer Portal stays redirect-based (no change)

**Estimated complexity**: Low-Medium — small backend action + moderate frontend work.

### Phase 3: Inline Payment on Signing Page (Sign-then-Pay)

**Goal**: Collect payments inline immediately after signature, using the PandaDoc-inspired sign-then-pay model.

**Why third**:

- Highest business impact (payment conversion)
- Architecture is much simpler than originally estimated — we keep invoices, just expose `client_secret`
- ~3 lines of new backend code per payment type function
- Frontend is the main work: post-signature payment flow + inline PaymentElement

**Scope**:

1. Backend: After `finalizeInvoice()`, retrieve the underlying PaymentIntent's `client_secret` and return it alongside `hosted_invoice_url`
2. Backend: New query for signing page to fetch payment `client_secret` by signing token
3. Frontend: After signature submission, if payment fields exist, show "Waiting for payment" state with inline `<PaymentElement />`
4. Frontend: Replace "Pay Now →" external link in `PaymentFieldSummary` with inline payment form
5. Frontend: Handle payment confirmation → transition to "Completed"
6. Fallback: Signers who close before paying can return via signing link, or pay via hosted invoice URL in email

**What does NOT change**: Invoice creation, line items, subscriptions, webhooks, platform fees — the entire `payment_field_actions.ts` logic stays intact.

**Estimated complexity**: Medium — minimal backend changes, moderate frontend work for the post-signature payment flow.

### Phase 4: Connect Account Dashboard (retired provider Stats Section)

**Goal**: Provide connected accounts with dedicated pages for payment history, payouts, balances, disputes, and tax documents — all powered by retired provider Connect embedded components.

**Why last**:

- Net-new feature, not replacing existing flow
- Lower priority than core signing experience
- Can be deferred based on user demand

**Critical constraint**: Not all Seal organizations use retired provider Connect. These pages and their sidebar links must only appear when the org has a connected retired provider account.

**Scope** (informed by [Plasma portal pattern](#plasma-portal-pattern)):

1. Create reusable `retired providerConnectProvider` component (`integrations/retired_provider/connect-provider.tsx`) with:
   - AccountSession creation via `fetchClientSecret` callback
   - Skeleton loading, error states, theme sync
   - Session refresh for long-running pages
2. Create dedicated settings routes:
   - `settings/payment-history` — `<ConnectPayments />`
   - `settings/payouts` — `<ConnectPayouts />`
   - `settings/balances` — `<ConnectBalances />` + `<ConnectInstantPayoutsPromotion />`
   - `settings/disputes` — `<ConnectDisputesList />`
   - `settings/tax-documents` — `<ConnectDocuments />`
3. Each page follows the pattern: permission check → `retired providerConnectProvider` → `ConnectNotificationBanner` + main component
4. Conditional sidebar navigation — query `retired_provider_accounts` table, show links only when org has connected account
5. "No retired provider Connect" empty state for direct URL access (user types URL but org has no retired provider)

**Files affected**:

- `apps/web/src/integrations/retired_provider/connect-provider.tsx` — new (shared with Phase 1)
- `apps/web/src/routes/_authenticated/$slug/settings/payment-history.tsx` — new
- `apps/web/src/routes/_authenticated/$slug/settings/payouts.tsx` — new
- `apps/web/src/routes/_authenticated/$slug/settings/balances.tsx` — new
- `apps/web/src/routes/_authenticated/$slug/settings/disputes.tsx` — new
- `apps/web/src/routes/_authenticated/$slug/settings/tax-documents.tsx` — new
- Sidebar component — conditional Connect section

**Estimated complexity**: Medium — repetitive pattern across 5 pages, but each is simple (provider + one retired provider component).

---

## Priority Matrix

| Phase | Feature                        | Impact                             | Effort                      | Priority                  |
| ----- | ------------------------------ | ---------------------------------- | --------------------------- | ------------------------- |
| 1     | Connect Onboarding             | Medium (better setup UX)           | Medium                      | **High**                  |
| 2     | Embedded Checkout              | Medium (less friction for billing) | Low-Medium                  | **High**                  |
| 3     | Inline Payment (Sign-then-Pay) | **High** (payment conversion)      | Medium (invoice arch stays) | **High** (do after 1 & 2) |
| 4     | Connect Dashboard              | Low (nice-to-have)                 | Medium                      | **Low**                   |

---

## Technical Requirements

### Packages to Install

```bash
# Connect Embedded Components (Phase 1)
bun add @retired_provider/connect-js @retired_provider/react-connect-js

# retired provider Elements + Embedded Checkout (Phase 2 & 3)
bun add @retired_provider/retired_provider-js @retired_provider/react-retired_provider-js
```

### Backend: New AccountSession Action

```typescript
// apps/backend/convex/retired_provider/connect_actions.ts
export const createAccountSession = action({
  args: { retired_providerAccountId: v.string() },
  handler: async (ctx, args) => {
    const retired_provider = initializeretired provider();
    const accountSession = await retired_provider.accountSessions.create({
      account: args.retired_providerAccountId,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
        notification_banner: { enabled: true },
      },
    });
    return { clientSecret: accountSession.client_secret };
  },
});
```

### Frontend: ConnectComponentsProvider Setup

```typescript
// apps/web/src/integrations/retired_provider/connect-provider.tsx
import { ConnectComponentsProvider } from "@retired_provider/react-connect-js";
import { loadConnectAndInitialize } from "@retired_provider/connect-js";

export function retired providerConnectProvider({ children, fetchClientSecret }) {
  const [connectInstance] = useState(() =>
    loadConnectAndInitialize({
      publishableKey: import.meta.env.VITE_RETIRED_PROVIDER_PUBLISHABLE_KEY,
      fetchClientSecret,
      appearance: {
        overlays: "dialog",
        variables: {
          colorPrimary: "#0f172a", // Match Seal's design system
        },
      },
    })
  );

  return (
    <ConnectComponentsProvider connectInstance={connectInstance}>
      {children}
    </ConnectComponentsProvider>
  );
}
```

### Environment Variables

```bash
# Already exists
VITE_RETIRED_PROVIDER_PUBLISHABLE_KEY=pk_...

# No new env vars needed — Connect components use the same publishable key
```

### retired provider Dashboard Configuration

For Connect Embedded Components:

1. Enable "Embedded components" in Connect Settings
2. Configure branding (logo, colors, favicon) in Connect Settings → Branding
3. Set redirect URLs for Account Onboarding completion

For Embedded Checkout:

1. No special dashboard configuration needed
2. Uses existing products/prices

---

## Data Loading Architecture

retired provider embedded components load data **from retired provider's servers**, not from Convex. This creates two distinct categories:

### Category 1: Process Components (retired provider-Loaded — Fine As-Is)

These components are part of an **active user flow** where retired provider handling its own data loading is natural and expected:

| Component                      | Context                              | Why retired provider-Loading Is Fine                                   |
| ------------------------------ | ------------------------------------ | ---------------------------------------------------------------------- |
| `<PaymentElement />`           | Signing page — collecting payment    | User is actively paying. retired provider loads its own PaymentIntent. |
| `<EmbeddedCheckout />`         | Billing page — subscription checkout | User is actively checking out. retired provider loads its own session. |
| `<ConnectAccountOnboarding />` | Settings — Connect setup             | User is actively onboarding. retired provider manages the flow.        |
| `<ConnectAccountManagement />` | Settings — account updates           | User is actively editing retired provider settings.                    |

**No architectural concern** — these are transactional components where retired provider's data loading is the feature.

### Category 2: Stats Components (retired provider-Loaded — Needs Dedicated Section)

These components display **read-only account information** loaded entirely from retired provider. They feel like dashboard widgets but load data from a completely different system than the rest of Seal (Convex):

| Component                 | What It Shows             |
| ------------------------- | ------------------------- |
| `<ConnectPayments />`     | Payment history table     |
| `<ConnectPayouts />`      | Payout history + schedule |
| `<ConnectBalances />`     | Available/pending balance |
| `<ConnectDisputesList />` | Active disputes           |
| `<ConnectDocuments />`    | Tax documents (1099s)     |

**Architectural approach** (informed by [Plasma portal pattern](#plasma-portal-pattern)):

1. **Dedicated routes, not embedded in existing pages** — Each stats component gets its own route under `settings/` (e.g., `settings/payment-history`, `settings/payouts`, `settings/balances`). This keeps them isolated from Convex-driven pages.

2. **Conditional navigation** — Not all Seal organizations use retired provider Connect. These routes and their sidebar links **only appear when the org has a connected retired provider account** (`retired_provider_accounts` table has a record for this org). Organizations without retired provider Connect never see these pages.

3. **Shared `retired providerConnectProvider`** — A reusable provider component (like Plasma's `ConnectProvider`) handles:
   - AccountSession creation + `fetchClientSecret` callback
   - Skeleton loading during initialization
   - Error states (retired provider unreachable, session expired)
   - Dynamic theme sync (dark/light mode)
   - Session refresh for long-lived pages

4. **Permission gating** — Each stats page checks for appropriate permissions before rendering. The Connect provider is only initialized after permission checks pass.

### Plasma Portal Pattern

The Plasma codebase (`apps/portal/`) implements this exact pattern and serves as the reference implementation:

| Plasma Route | Component                                                    | Seal Equivalent            |
| ------------ | ------------------------------------------------------------ | -------------------------- |
| `/payments`  | `<ConnectPayments />`                                        | `settings/payment-history` |
| `/payouts`   | `<ConnectPayouts />`                                         | `settings/payouts`         |
| `/balances`  | `<ConnectBalances />` + `<ConnectInstantPayoutsPromotion />` | `settings/balances`        |
| `/disputes`  | `<ConnectDisputesList />`                                    | `settings/disputes`        |
| `/documents` | `<ConnectDocuments />`                                       | `settings/tax-documents`   |

**Key difference**: In Plasma, retired provider Connect is **required** for all portal access (no retired provider account → redirect to onboarding). In Seal, retired provider Connect is **optional** — the sidebar conditionally shows these pages only when the org has connected a retired provider account.

**Pattern per page**:

```tsx
// Every stats page follows the same structure:
function PaymentHistoryPage() {
  const retired_providerAccount = useQuery(api.retired_provider.getretired providerAccount, { orgId });
  const { hasPermission } = usePermissions();

  if (!retired_providerAccount) return <Noretired providerConnectMessage />;
  if (!hasPermission("payments:view")) return <AccessDenied />;

  return (
    <retired providerConnectProvider orgId={orgId}>
      <ConnectNotificationBanner />
      <ConnectPayments />
    </retired providerConnectProvider>
  );
}
```

---

## Implementation Notes

Details that will be handled during implementation (not decisions — just notes for the implementer):

### Payment Failure Handling

`<PaymentElement />` handles retries natively — the user can re-enter card details if payment fails. If the user abandons the page, the document stays in `waiting_for_payment` and they can return via their signing link. The `invoice.payment_failed` webhook fires to notify the sender. The `hosted_invoice_url` in the email serves as the ultimate fallback.

### AccountSession Refresh

Connect embedded component sessions expire on long-running pages. The `retired providerConnectProvider` must implement `fetchClientSecret` as a **callback** (not a one-time fetch) — retired provider calls it automatically when the session expires. Plasma's `ConnectProvider` implementation is the reference pattern for this.

---

## Components NOT Relevant to Seal

For completeness, these Connect components exist but are **not relevant** to Seal's document-signing use case:

| Component                        | Why Not Relevant                                   |
| -------------------------------- | -------------------------------------------------- |
| Capital (3 components)           | retired provider Capital lending — not applicable  |
| Tax (5 components)               | Tax compliance tooling — Seal doesn't manage taxes |
| Financial Account / Transactions | Treasury/banking — not applicable                  |
| Issuing Card / Cards List        | Card issuing — not applicable                      |
| Reporting Chart                  | Generic reporting — Seal has its own analytics     |
| App Install / App Viewport       | retired provider Apps marketplace — not applicable |
| Currency Selector Element        | Multi-currency — not needed currently              |
| Tax ID Element                   | B2B tax IDs — not core to signing flow             |

---

## Standard Account Compatibility

**Confirmed**: Connect embedded components support **all account types**, including Standard.

Source: retired provider developer community via retired provider MCP documentation search:

> "Embedded Components now support all account types, including Standard and Express. This feature has been in development for the last couple of years."

Seal currently creates Standard accounts via `retired_provider.accounts.create({ type: "standard" })` in `connect_actions.ts`. This is fully compatible with the AccountSession API and all Connect embedded components.

### Future-proofing note

retired provider is migrating platforms toward **controller properties** instead of legacy account types. From the [migration guide](https://docs.retired_provider.com/connect/configuration-migration-guide):

> "If you're setting up a new Connect platform, see Configure the behavior of connected accounts to learn about connected account configurations."

This doesn't block any phase — our Standard accounts work today. But when we eventually refactor, we should consider migrating to controller properties for new accounts. The embedded components work identically with either approach.

### retired provider Documentation References

- [Standard Accounts Guide](https://docs.retired_provider.com/connect/standard-accounts)
- [Embedded Onboarding](https://docs.retired_provider.com/connect/embedded-onboarding)
- [Supported Embedded Components](https://docs.retired_provider.com/connect/supported-embedded-components)
- [Connect Embedded Components Quickstart](https://docs.retired_provider.com/connect/connect-embedded-components/quickstart)
- [Configuration Migration Guide](https://docs.retired_provider.com/connect/configuration-migration-guide)
