# Payments Hub Design

## Problem

Seal has comprehensive Stripe Connect integration (payouts, balances, disputes, tax documents, payment history) but it's buried in workspace settings where users rarely find it. Competitor agree.com surfaces payments as a first-class section with dedicated navigation. Additionally, Seal lacks revenue overview and subscription management views despite having the backend data (`document_invoices` table, recurring payment configs).

## Solution

Create a dedicated Payments section in the main workspace sidebar that:
1. Promotes existing Stripe Connect pages from settings to main navigation
2. Adds a Payments Overview page with revenue summary and transaction list
3. Adds a Subscriptions page for managing recurring document payments

## Architecture

### Route Structure

```
/$slug/payments/           → Overview (revenue cards + transaction list)
/$slug/payments/subscriptions → Active recurring payments management
/$slug/payments/history    → Existing payment-history page (moved)
/$slug/payments/payouts    → Existing payouts page (moved)
/$slug/payments/balances   → Existing balances page (moved)
/$slug/payments/disputes   → Existing disputes page (moved)
/$slug/payments/tax        → Existing tax-documents page (moved)
```

### Navigation

Add "Payments" to the workspace sidebar (between Documents and Templates). Uses a collapsible sub-navigation with items: Overview, Subscriptions, History, Payouts, Balances, Disputes, Tax Documents.

### New Backend Queries

**`stripe/revenue_queries.ts`**:
- `getRevenueStats` — Aggregates from `document_invoices`: total revenue, paid count, pending count, monthly trend. Scoped to organization.
- `getTransactionList` — Paginated list from `document_invoices` joined with document title. Filterable by status (paid/open/void).

**`stripe/subscription_queries.ts`**:
- `getActiveRecurringPayments` — Finds documents with `paymentType: "recurring"` payment fields that have active Stripe subscriptions. Returns subscription details (amount, interval, status, customer).
- `pauseRecurringPayment` — Calls Stripe API to pause a subscription.
- `cancelRecurringPayment` — Calls Stripe API to cancel a subscription.

### New Frontend Pages

**Payments Overview** (`/$slug/payments/index.tsx`):
- 4 summary cards: Total Revenue, Paid Invoices, Pending Invoices, Monthly Revenue
- Transaction table with columns: Document, Customer, Amount, Status, Date
- Filters: status, date range
- Uses existing `permissionQuery("payments:view")` wrapper

**Subscriptions** (`/$slug/payments/subscriptions.tsx`):
- Table of active recurring payments: Document, Customer, Amount, Interval, Status, Next Payment
- Actions: Pause, Resume, Cancel (with confirmation dialog)
- Empty state when no recurring payments exist

### Existing Pages (Moved)

The following pages move from `settings/` to `payments/` with minimal code changes — primarily updating route paths and imports:

| Current Route | New Route |
|---|---|
| `settings/payment-history` | `payments/history` |
| `settings/payouts` | `payments/payouts` |
| `settings/balances` | `payments/balances` |
| `settings/disputes` | `payments/disputes` |
| `settings/tax-documents` | `payments/tax` |

The `settings/payments` page (Stripe Connect onboarding) stays in settings since it's a one-time setup flow.

### Permissions

Reuse existing payment-related permissions. Overview and subscriptions pages require `payments:view`. Pause/cancel actions require `payments:manage`.

## Files to Create

| File | Purpose |
|---|---|
| `routes/_authenticated/$slug/payments.tsx` | Layout route with sub-navigation |
| `routes/_authenticated/$slug/payments/index.tsx` | Overview page |
| `routes/_authenticated/$slug/payments/subscriptions.tsx` | Subscriptions management |
| `routes/_authenticated/$slug/payments/history.tsx` | Moved from settings |
| `routes/_authenticated/$slug/payments/payouts.tsx` | Moved from settings |
| `routes/_authenticated/$slug/payments/balances.tsx` | Moved from settings |
| `routes/_authenticated/$slug/payments/disputes.tsx` | Moved from settings |
| `routes/_authenticated/$slug/payments/tax.tsx` | Moved from settings |
| `convex/stripe/revenue_queries.ts` | Revenue stats and transaction list |
| `convex/stripe/subscription_queries.ts` | Recurring payment management |

## Files to Modify

| File | Change |
|---|---|
| Sidebar component | Add Payments nav section |
| `settings/payments.tsx` | Keep as-is (onboarding) |
| Remove old settings routes | `payment-history`, `payouts`, `balances`, `disputes`, `tax-documents` |

## Scope

- Full Agree-level parity for payment views
- Dedicated section, not extension of dashboard
- Subscription management (list, pause, cancel)
- Revenue overview with real data from `document_invoices`
