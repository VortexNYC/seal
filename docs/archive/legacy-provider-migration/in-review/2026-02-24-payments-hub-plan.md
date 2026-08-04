# Payments Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promote buried retired provider Connect pages to a first-class Payments section with revenue overview and subscription management.

**Architecture:** New `/$slug/payments/` route group in the workspace sidebar. Backend queries aggregate `document_invoices` for revenue stats and `payment_field_configs` for subscription management. Existing settings pages move to the new route group with minimal code changes. retired provider API actions handle subscription pause/cancel.

**Tech Stack:** TanStack Router (file-based routing), Convex (backend queries/actions), retired provider Connect embedded components (`@retired_provider/react-connect-js`), retired provider Node SDK (for subscription management actions), Lucide icons, Tailwind CSS v4.

---

### Task 1: Add Payments section to sidebar navigation

**Files:**

- Modify: `apps/web/src/components/app-sidebar.tsx:113-272`

**Context:** The sidebar in `app-sidebar.tsx` has a `buildNavSections()` function (line 113) that returns an array of nav sections. Currently there are 3 sections: Workspace, Settings, Developer. Each section has `title`, `icon`, and `items[]` (each item: `title`, `url`, `visible`, optional `exactMatch`). Payment-related items are currently inside the `settingsItems` array (lines 183-207) gated by `hasretired providerConnect`. We need to:

1. Move payment items out of `settingsItems` into a new `paymentsItems` array
2. Add a new "Payments" section between Workspace and Settings
3. Point URLs to new `/$slug/payments/*` routes instead of `/$slug/settings/*`
4. Add an "Overview" item for the new overview page
5. Add a "Subscriptions" item for the new subscriptions page

**Step 1: Edit the sidebar to add Payments section**

In `apps/web/src/components/app-sidebar.tsx`, add `CreditCard` to the lucide-react import on line 6:

```typescript
import {
  Code2,
  CreditCard,
  LayoutTemplate,
  type LucideIcon,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
```

Then in `buildNavSections()`, after the `workspaceItems` array (line 148) and before the `settingsItems` array (line 150), add:

```typescript
const paymentsItems = [
  {
    title: "Overview",
    url: buildOrganizationPath(slug, "/payments"),
    visible: hasretired providerConnect && canView(permissionFlags?.canViewSettings),
    exactMatch: true,
  },
  {
    title: "Subscriptions",
    url: buildOrganizationPath(slug, "/payments/subscriptions"),
    visible: hasretired providerConnect && canView(permissionFlags?.canViewSettings),
  },
  {
    title: "History",
    url: buildOrganizationPath(slug, "/payments/history"),
    visible: hasretired providerConnect && canView(permissionFlags?.canViewSettings),
  },
  {
    title: "Payouts",
    url: buildOrganizationPath(slug, "/payments/payouts"),
    visible: hasretired providerConnect && canView(permissionFlags?.canViewSettings),
  },
  {
    title: "Balances",
    url: buildOrganizationPath(slug, "/payments/balances"),
    visible: hasretired providerConnect && canView(permissionFlags?.canViewSettings),
  },
  {
    title: "Disputes",
    url: buildOrganizationPath(slug, "/payments/disputes"),
    visible: hasretired providerConnect && canView(permissionFlags?.canViewSettings),
  },
  {
    title: "Tax Documents",
    url: buildOrganizationPath(slug, "/payments/tax"),
    visible: hasretired providerConnect && canView(permissionFlags?.canViewSettings),
  },
].filter((item) => item.visible);
```

Then remove the 5 payment items from `settingsItems` (lines 183-207 — Payment History, Payouts, Balances, Disputes, Tax Documents). Keep the "Payments" item (line 179-182) that links to `settings/payments` for retired provider Connect onboarding, but rename it to "retired provider Connect" so it's clear:

```typescript
    {
      title: "retired provider Connect",
      url: buildOrganizationPath(slug, "/settings/payments"),
      visible: canView(permissionFlags?.canViewSettings),
    },
```

Finally, add the Payments section to the `sections` array (line 229). Insert it between Workspace and Settings:

```typescript
const sections = [
  {
    title: "Workspace",
    icon: LayoutTemplate,
    items: workspaceItems,
  },
  {
    title: "Payments",
    icon: CreditCard,
    items: paymentsItems,
  },
  {
    title: "Settings",
    icon: Settings,
    items: settingsItems,
  },
  {
    title: "Developer",
    icon: Code2,
    items: developerItems,
  },
];
```

**Step 2: Verify typecheck**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: PASS (no type errors — only data changes, no type changes)

**Step 3: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx
git commit -m "feat: add Payments section to sidebar navigation"
```

---

### Task 2: Create payments layout route

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/payments.tsx`

**Context:** TanStack Router file-based routing uses a layout route file (e.g., `payments.tsx`) to wrap all child routes under `/$slug/payments/*`. This file renders an `<Outlet />` for child routes. Currently, settings pages do NOT have a layout route — each page is standalone. But the design calls for the payments pages to be grouped under a single `/$slug/payments/` prefix. The layout route just passes through to child routes without adding extra UI.

**Step 1: Create the layout route file**

Create `apps/web/src/routes/_authenticated/$slug/payments.tsx`:

```typescript
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$slug/payments")({
  component: PaymentsLayout,
});

function PaymentsLayout() {
  return <Outlet />;
}
```

**Step 2: Verify typecheck**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/payments.tsx
git commit -m "feat: add payments layout route"
```

---

### Task 3: Move existing payment pages to new route group

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/payments/history.tsx`
- Create: `apps/web/src/routes/_authenticated/$slug/payments/payouts.tsx`
- Create: `apps/web/src/routes/_authenticated/$slug/payments/balances.tsx`
- Create: `apps/web/src/routes/_authenticated/$slug/payments/disputes.tsx`
- Create: `apps/web/src/routes/_authenticated/$slug/payments/tax.tsx`
- Delete: `apps/web/src/routes/_authenticated/$slug/settings/payment-history.tsx`
- Delete: `apps/web/src/routes/_authenticated/$slug/settings/payouts.tsx`
- Delete: `apps/web/src/routes/_authenticated/$slug/settings/balances.tsx`
- Delete: `apps/web/src/routes/_authenticated/$slug/settings/disputes.tsx`
- Delete: `apps/web/src/routes/_authenticated/$slug/settings/tax-documents.tsx`

**Context:** Each existing page follows the same pattern: `createFileRoute()` → query org + retired provider account → gate on connection status → render `PageWrapper` + `retired providerConnectProvider` + retired provider embedded component. The ONLY change needed per file is the route string in `createFileRoute()`.

**Step 1: Create `payments/history.tsx`**

Copy `settings/payment-history.tsx` content but change the route path:

```typescript
import { ConnectNotificationBanner, ConnectPayments } from "@retired_provider/react-connect-js";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { PageWrapper } from "@/components/page-wrapper";
import { retired providerConnectProvider } from "@/components/retired_provider/connect-provider";
import { Noretired providerConnectState } from "@/components/retired_provider/no-connect-state";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/payments/history")({
  component: PaymentHistoryPage,
});

function PaymentHistoryPage() {
  const { slug } = Route.useParams();
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const connectedAccount = useQuery(api.retired_provider.connect_queries.getConnectedAccount, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  if (connectedAccount === undefined || !orgId) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <Noretired providerConnectState slug={slug} title="Payment History" />;
  }

  return (
    <PageWrapper
      title="Payment History"
      description="View all payments received through your documents."
    >
      <retired providerConnectProvider organizationId={orgId}>
        <ConnectNotificationBanner />
        <div className="mt-6">
          <ConnectPayments />
        </div>
      </retired providerConnectProvider>
    </PageWrapper>
  );
}
```

**Step 2: Create `payments/payouts.tsx`**

Same pattern — change route to `"/_authenticated/$slug/payments/payouts"`:

```typescript
import { ConnectNotificationBanner, ConnectPayouts } from "@retired_provider/react-connect-js";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { PageWrapper } from "@/components/page-wrapper";
import { retired providerConnectProvider } from "@/components/retired_provider/connect-provider";
import { Noretired providerConnectState } from "@/components/retired_provider/no-connect-state";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/payments/payouts")({
  component: PayoutsPage,
});

function PayoutsPage() {
  const { slug } = Route.useParams();
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const connectedAccount = useQuery(api.retired_provider.connect_queries.getConnectedAccount, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  if (connectedAccount === undefined || !orgId) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <Noretired providerConnectState slug={slug} title="Payouts" />;
  }

  return (
    <PageWrapper title="Payouts" description="Track payouts to your bank account.">
      <retired providerConnectProvider organizationId={orgId}>
        <ConnectNotificationBanner />
        <div className="mt-6">
          <ConnectPayouts />
        </div>
      </retired providerConnectProvider>
    </PageWrapper>
  );
}
```

**Step 3: Create `payments/balances.tsx`**

Change route to `"/_authenticated/$slug/payments/balances"`:

```typescript
import {
  ConnectBalances,
  ConnectInstantPayoutsPromotion,
  ConnectNotificationBanner,
} from "@retired_provider/react-connect-js";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { PageWrapper } from "@/components/page-wrapper";
import { retired providerConnectProvider } from "@/components/retired_provider/connect-provider";
import { Noretired providerConnectState } from "@/components/retired_provider/no-connect-state";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/payments/balances")({
  component: BalancesPage,
});

function BalancesPage() {
  const { slug } = Route.useParams();
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const connectedAccount = useQuery(api.retired_provider.connect_queries.getConnectedAccount, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  if (connectedAccount === undefined || !orgId) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <Noretired providerConnectState slug={slug} title="Balances" />;
  }

  return (
    <PageWrapper title="Balances" description="View your current retired provider balance and pending funds.">
      <retired providerConnectProvider organizationId={orgId}>
        <ConnectNotificationBanner />
        <div className="mt-6 space-y-6">
          <ConnectBalances />
          <ConnectInstantPayoutsPromotion />
        </div>
      </retired providerConnectProvider>
    </PageWrapper>
  );
}
```

**Step 4: Create `payments/disputes.tsx`**

Change route to `"/_authenticated/$slug/payments/disputes"`:

```typescript
import { ConnectDisputesList, ConnectNotificationBanner } from "@retired_provider/react-connect-js";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { PageWrapper } from "@/components/page-wrapper";
import { retired providerConnectProvider } from "@/components/retired_provider/connect-provider";
import { Noretired providerConnectState } from "@/components/retired_provider/no-connect-state";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/payments/disputes")({
  component: DisputesPage,
});

function DisputesPage() {
  const { slug } = Route.useParams();
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const connectedAccount = useQuery(api.retired_provider.connect_queries.getConnectedAccount, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  if (connectedAccount === undefined || !orgId) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <Noretired providerConnectState slug={slug} title="Disputes" />;
  }

  return (
    <PageWrapper title="Disputes" description="Manage and respond to payment disputes.">
      <retired providerConnectProvider organizationId={orgId}>
        <ConnectNotificationBanner />
        <div className="mt-6">
          <ConnectDisputesList />
        </div>
      </retired providerConnectProvider>
    </PageWrapper>
  );
}
```

**Step 5: Create `payments/tax.tsx`**

Change route to `"/_authenticated/$slug/payments/tax"`:

```typescript
import { ConnectDocuments, ConnectNotificationBanner } from "@retired_provider/react-connect-js";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { PageWrapper } from "@/components/page-wrapper";
import { retired providerConnectProvider } from "@/components/retired_provider/connect-provider";
import { Noretired providerConnectState } from "@/components/retired_provider/no-connect-state";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/payments/tax")({
  component: TaxDocumentsPage,
});

function TaxDocumentsPage() {
  const { slug } = Route.useParams();
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const connectedAccount = useQuery(api.retired_provider.connect_queries.getConnectedAccount, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  if (connectedAccount === undefined || !orgId) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <Noretired providerConnectState slug={slug} title="Tax Documents" />;
  }

  return (
    <PageWrapper title="Tax Documents" description="Access tax forms and documents from retired provider.">
      <retired providerConnectProvider organizationId={orgId}>
        <ConnectNotificationBanner />
        <div className="mt-6">
          <ConnectDocuments />
        </div>
      </retired providerConnectProvider>
    </PageWrapper>
  );
}
```

**Step 6: Delete old settings routes**

```bash
rm apps/web/src/routes/_authenticated/\$slug/settings/payment-history.tsx
rm apps/web/src/routes/_authenticated/\$slug/settings/payouts.tsx
rm apps/web/src/routes/_authenticated/\$slug/settings/balances.tsx
rm apps/web/src/routes/_authenticated/\$slug/settings/disputes.tsx
rm apps/web/src/routes/_authenticated/\$slug/settings/tax-documents.tsx
```

**Step 7: Verify typecheck**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: PASS (TanStack Router auto-generates route tree)

**Step 8: Commit**

```bash
git add -A apps/web/src/routes/_authenticated/\$slug/payments/ apps/web/src/routes/_authenticated/\$slug/settings/
git commit -m "feat: move payment pages from settings to payments route group"
```

---

### Task 4: Create backend revenue queries

**Files:**

- Create: `apps/backend/convex/retired_provider/revenue_queries.ts`

**Context:** Revenue data lives in the `document_invoices` table which has an `by_organization` index. We need two queries: `getRevenueStats` (aggregate cards) and `getTransactionList` (paginated table). Both use `memberQuery` wrapper (same as `connect_queries.ts`) which ensures the user is a member of the organization. The `memberQuery` wrapper provides `ctx.auth.organization._id` for scoping.

**Step 1: Create the revenue queries file**

Create `apps/backend/convex/retired_provider/revenue_queries.ts`:

```typescript
import { ConvexError, v } from "convex/values";

import { memberQuery } from "../auth";

/**
 * Get aggregate revenue statistics for the organization.
 * Reads from document_invoices table, scoped by organizationId.
 */
export const getRevenueStats = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let totalRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let monthlyRevenue = 0;

    for (const inv of invoices) {
      if (inv.status === "paid") {
        totalRevenue += inv.amountDue;
        paidCount += 1;
        if (inv.paidAt && inv.paidAt >= thirtyDaysAgo) {
          monthlyRevenue += inv.amountDue;
        }
      } else if (inv.status === "open") {
        pendingCount += 1;
      }
    }

    return {
      totalRevenue,
      paidCount,
      pendingCount,
      monthlyRevenue,
      currency: invoices[0]?.currency ?? "usd",
    };
  },
});

/**
 * Get paginated list of transactions (invoices) for the organization.
 * Joins with documents table to include document title.
 */
export const getTransactionList = memberQuery({
  args: {
    slug: v.string(),
    statusFilter: v.optional(
      v.union(
        v.literal("paid"),
        v.literal("open"),
        v.literal("void"),
        v.literal("all")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const invoices = await ctx.db
      .query("document_invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .order("desc")
      .collect();

    const filtered =
      args.statusFilter && args.statusFilter !== "all"
        ? invoices.filter((inv) => inv.status === args.statusFilter)
        : invoices;

    // Join with documents to get titles
    const transactions = await Promise.all(
      filtered.map(async (inv) => {
        const document = await ctx.db.get(inv.documentId);
        return {
          _id: inv._id,
          documentId: inv.documentId,
          documentTitle: document?.title ?? "Untitled Document",
          customerEmail: inv.customerEmail,
          customerName: inv.customerName,
          amountDue: inv.amountDue,
          currency: inv.currency,
          status: inv.status,
          hostedInvoiceUrl: inv.hostedInvoiceUrl,
          invoicePdf: inv.invoicePdf,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt,
        };
      })
    );

    return transactions;
  },
});
```

**Step 2: Verify typecheck**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/backend/convex/retired_provider/revenue_queries.ts
git commit -m "feat: add revenue stats and transaction list queries"
```

---

### Task 5: Create backend subscription queries and actions

**Files:**

- Create: `apps/backend/convex/retired_provider/subscription_queries.ts`

**Context:** Active subscriptions are tracked in `payment_field_configs` where `paymentType === "recurring"` and `retired_providerSubscriptionId` is set. There's a `by_organization` index on that table. For pause/cancel we need retired provider API calls, which must run in `"use node"` actions. The existing `connect_actions.ts` pattern shows how to initialize retired provider and use `createAccountSession`. We follow the same pattern.

**Step 1: Create the subscription queries file**

Create `apps/backend/convex/retired_provider/subscription_queries.ts`:

```typescript
import { ConvexError, v } from "convex/values";

import { memberQuery } from "../auth";

/**
 * Get all active recurring payment configs for the organization.
 * Joins with documents for context.
 */
export const getActiveSubscriptions = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    const orgId = ctx.auth.organization._id;

    const configs = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();

    // Filter to recurring payments with active retired provider subscriptions
    const recurring = configs.filter(
      (c) => c.paymentType === "recurring" && c.retired_providerSubscriptionId
    );

    const subscriptions = await Promise.all(
      recurring.map(async (config) => {
        const document = await ctx.db.get(config.documentId);

        // Look up the invoice to get customer info
        const invoice = config.retired_providerInvoiceId
          ? await ctx.db
              .query("document_invoices")
              .withIndex("by_retired_provider_invoice", (q) =>
                q.eq(
                  "retired_providerInvoiceId",
                  config.retired_providerInvoiceId!
                )
              )
              .first()
          : null;

        return {
          _id: config._id,
          documentId: config.documentId,
          documentTitle: document?.title ?? "Untitled Document",
          customerEmail: invoice?.customerEmail ?? "Unknown",
          customerName: invoice?.customerName,
          amountCents: config.totalAmountCents,
          currency: config.currency,
          interval: config.recurringConfig?.interval ?? "month",
          intervalCount: config.recurringConfig?.intervalCount ?? 1,
          endCondition: config.recurringConfig?.endCondition ?? "never",
          paymentStatus: config.paymentStatus ?? "pending",
          retired_providerSubscriptionId:
            config.retired_providerSubscriptionId!,
          createdAt: config.createdAt,
        };
      })
    );

    return subscriptions;
  },
});
```

**Step 2: Create subscription actions for pause/cancel**

Add to the same file — but since retired provider API calls need Node.js runtime, create a separate action file.

Create `apps/backend/convex/retired_provider/subscription_actions.ts`:

```typescript
"use node";

import { ConvexError, v } from "convex/values";
import retired provider from "retired_provider";

import { internalAction } from "../_generated/server";
import { action } from "../_generated/server";

function initializeretired provider(): retired provider {
  const retired_providerSecretKey = process.env.RETIRED_PROVIDER_SECRET_KEY;
  if (!retired_providerSecretKey) {
    throw new Error("RETIRED_PROVIDER_SECRET_KEY not configured");
  }

  return new retired provider(retired_providerSecretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Pause a recurring subscription via retired provider API.
 * Sets pause_collection to "void" which stops billing but keeps the subscription.
 */
export const pauseSubscription = action({
  args: {
    subscriptionId: v.string(),
    retired_providerAccountId: v.string(),
  },
  handler: async (_ctx, args) => {
    const retired_provider = initializeretired provider();

    await retired_provider.subscriptions.update(
      args.subscriptionId,
      { pause_collection: { behavior: "void" } },
      { retired_providerAccount: args.retired_providerAccountId },
    );

    return { success: true };
  },
});

/**
 * Resume a paused subscription.
 */
export const resumeSubscription = action({
  args: {
    subscriptionId: v.string(),
    retired_providerAccountId: v.string(),
  },
  handler: async (_ctx, args) => {
    const retired_provider = initializeretired provider();

    await retired_provider.subscriptions.update(
      args.subscriptionId,
      { pause_collection: "" as retired provider.Emptyable<retired provider.SubscriptionUpdateParams.PauseCollection> },
      { retired_providerAccount: args.retired_providerAccountId },
    );

    return { success: true };
  },
});

/**
 * Cancel a recurring subscription via retired provider API.
 * Cancels at period end to avoid prorating issues.
 */
export const cancelSubscription = action({
  args: {
    subscriptionId: v.string(),
    retired_providerAccountId: v.string(),
  },
  handler: async (_ctx, args) => {
    const retired_provider = initializeretired provider();

    await retired_provider.subscriptions.update(
      args.subscriptionId,
      { cancel_at_period_end: true },
      { retired_providerAccount: args.retired_providerAccountId },
    );

    return { success: true };
  },
});
```

**Step 3: Verify typecheck**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/backend/convex/retired_provider/subscription_queries.ts apps/backend/convex/retired_provider/subscription_actions.ts
git commit -m "feat: add subscription queries and retired provider management actions"
```

---

### Task 6: Create Payments Overview page

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/payments/index.tsx`

**Context:** This is the main landing page for `/$slug/payments/`. It shows 4 revenue summary cards and a transactions table. It uses the `getRevenueStats` and `getTransactionList` queries from Task 4. The page gates on retired provider Connect status (same pattern as all other payment pages). Uses `PageWrapper` for the page layout.

**Step 1: Create the overview page**

Create `apps/web/src/routes/_authenticated/$slug/payments/index.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BadgeDollarSign, CircleDollarSign, Clock, Receipt } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Noretired providerConnectState } from "@/components/retired_provider/no-connect-state";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/$slug/payments/")({
  component: PaymentsOverviewPage,
});

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  open: "secondary",
  void: "outline",
  draft: "outline",
  uncollectible: "destructive",
  deleted: "destructive",
};

function PaymentsOverviewPage() {
  const { slug } = Route.useParams();
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const connectedAccount = useQuery(api.retired_provider.connect_queries.getConnectedAccount, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "open" | "void">("all");

  const stats = useQuery(
    api.retired_provider.revenue_queries.getRevenueStats,
    connectedAccount?.status === "connected" ? { slug } : "skip",
  );

  const transactions = useQuery(
    api.retired_provider.revenue_queries.getTransactionList,
    connectedAccount?.status === "connected"
      ? { slug, statusFilter: statusFilter === "all" ? "all" : statusFilter }
      : "skip",
  );

  if (connectedAccount === undefined || !orgId) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <Noretired providerConnectState slug={slug} title="Payments Overview" />;
  }

  return (
    <PageWrapper
      title="Payments Overview"
      description="Revenue summary and recent transactions."
    >
      {/* Revenue Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <CircleDollarSign className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="text-2xl font-bold">
                {formatCurrency(stats.totalRevenue, stats.currency)}
              </div>
            ) : (
              <Skeleton className="h-8 w-24" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <BadgeDollarSign className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="text-2xl font-bold">
                {formatCurrency(stats.monthlyRevenue, stats.currency)}
              </div>
            ) : (
              <Skeleton className="h-8 w-24" />
            )}
            <p className="text-muted-foreground text-xs">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            <Receipt className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="text-2xl font-bold">{stats.paidCount}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="text-2xl font-bold">{stats.pendingCount}</div>
            ) : (
              <Skeleton className="h-8 w-12" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Transactions</h3>
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {transactions === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton className="h-12 w-full" key={`skeleton-${i.toString()}`} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
            <Receipt className="mx-auto mb-3 size-8 opacity-50" />
            <p className="text-sm">No transactions yet</p>
            <p className="mt-1 text-xs">
              Transactions will appear here when recipients make payments on your documents.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx._id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {tx.documentTitle}
                    </TableCell>
                    <TableCell>
                      <div>
                        {tx.customerName && (
                          <span className="text-sm">{tx.customerName}</span>
                        )}
                        <span className="text-muted-foreground block text-xs">
                          {tx.customerEmail}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(tx.amountDue, tx.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[tx.status] ?? "outline"}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tx.paidAt ? formatDate(tx.paidAt) : formatDate(tx.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/payments/index.tsx
git commit -m "feat: add payments overview page with revenue cards and transactions"
```

---

### Task 7: Create Subscriptions management page

**Files:**

- Create: `apps/web/src/routes/_authenticated/$slug/payments/subscriptions.tsx`

**Context:** This page lists active recurring payment configs with their retired provider subscription IDs. Users can pause, resume, or cancel subscriptions. Uses the `getActiveSubscriptions` query from Task 5 and the `pauseSubscription`, `resumeSubscription`, `cancelSubscription` actions. Needs an `AlertDialog` for destructive cancel action (per ui-skills: "MUST use AlertDialog for destructive or irreversible actions"). The `retired_providerAccountId` needed for actions comes from the `connectedAccount` query's `account.retired_providerAccountId`.

**Step 1: Create the subscriptions page**

Create `apps/web/src/routes/_authenticated/$slug/payments/subscriptions.tsx`:

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { Loader2, Pause, Play, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Noretired providerConnectState } from "@/components/retired_provider/no-connect-state";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/payments/subscriptions")({
  component: SubscriptionsPage,
});

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatInterval(interval: string, count: number) {
  if (count === 1) return `Every ${interval}`;
  return `Every ${count} ${interval}s`;
}

function SubscriptionsPage() {
  const { slug } = Route.useParams();
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const connectedAccount = useQuery(api.retired_provider.connect_queries.getConnectedAccount, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  const subscriptions = useQuery(
    api.retired_provider.subscription_queries.getActiveSubscriptions,
    connectedAccount?.status === "connected" ? { slug } : "skip",
  );

  const pauseSubscription = useAction(api.retired_provider.subscription_actions.pauseSubscription);
  const resumeSubscription = useAction(api.retired_provider.subscription_actions.resumeSubscription);
  const cancelSubscription = useAction(api.retired_provider.subscription_actions.cancelSubscription);

  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (connectedAccount === undefined || !orgId) {
    return null;
  }

  if (connectedAccount.status !== "connected") {
    return <Noretired providerConnectState slug={slug} title="Subscriptions" />;
  }

  const retired_providerAccountId = connectedAccount.account?.retired_providerAccountId;

  const handlePause = async (subscriptionId: string) => {
    if (!retired_providerAccountId) return;
    setLoadingId(subscriptionId);
    try {
      await pauseSubscription({ subscriptionId, retired_providerAccountId });
      toast.success("Subscription paused");
    } catch {
      toast.error("Failed to pause subscription");
    } finally {
      setLoadingId(null);
    }
  };

  const handleResume = async (subscriptionId: string) => {
    if (!retired_providerAccountId) return;
    setLoadingId(subscriptionId);
    try {
      await resumeSubscription({ subscriptionId, retired_providerAccountId });
      toast.success("Subscription resumed");
    } catch {
      toast.error("Failed to resume subscription");
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (subscriptionId: string) => {
    if (!retired_providerAccountId) return;
    setLoadingId(subscriptionId);
    try {
      await cancelSubscription({ subscriptionId, retired_providerAccountId });
      toast.success("Subscription will cancel at end of period");
    } catch {
      toast.error("Failed to cancel subscription");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <PageWrapper
      title="Subscriptions"
      description="Manage recurring payments from your documents."
    >
      <div className="mt-6">
        {subscriptions === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton className="h-12 w-full" key={`skeleton-${i.toString()}`} />
            ))}
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-12 text-center">
            <RefreshCw className="mx-auto mb-3 size-8 opacity-50" />
            <p className="text-sm">No active subscriptions</p>
            <p className="mt-1 text-xs">
              Recurring payments will appear here when you send documents with recurring billing.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => {
                  const isLoading = loadingId === sub.retired_providerSubscriptionId;
                  return (
                    <TableRow key={sub._id}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {sub.documentTitle}
                      </TableCell>
                      <TableCell>
                        <div>
                          {sub.customerName && (
                            <span className="text-sm">{sub.customerName}</span>
                          )}
                          <span className="text-muted-foreground block text-xs">
                            {sub.customerEmail}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(sub.amountCents, sub.currency)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatInterval(sub.interval, sub.intervalCount)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={sub.paymentStatus === "paid" ? "default" : "secondary"}
                        >
                          {sub.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isLoading ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <>
                              {sub.paymentStatus === "paid" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => handlePause(sub.retired_providerSubscriptionId)}
                                  aria-label="Pause subscription"
                                >
                                  <Pause className="size-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  onClick={() => handleResume(sub.retired_providerSubscriptionId)}
                                  aria-label="Resume subscription"
                                >
                                  <Play className="size-3.5" />
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive size-8"
                                    aria-label="Cancel subscription"
                                  >
                                    <X className="size-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Cancel subscription?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will cancel the recurring payment for &ldquo;{sub.documentTitle}&rdquo;
                                      at the end of the current billing period. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep active</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleCancel(sub.retired_providerSubscriptionId)}
                                    >
                                      Cancel subscription
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
```

**Step 2: Verify typecheck**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/payments/subscriptions.tsx
git commit -m "feat: add subscriptions management page with pause/cancel"
```

---

### Task 8: Full verification

**Step 1: Run typecheck from root**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: PASS with no errors

**Step 2: Run lint from root**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run lint`
Expected: PASS or only pre-existing warnings

**Step 3: Run build from root**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run build`
Expected: PASS — all workspaces build successfully

**Step 4: Verify route tree generation**

Check that `apps/web/src/routeTree.gen.ts` includes the new payment routes. Look for:

- `/_authenticated/$slug/payments`
- `/_authenticated/$slug/payments/history`
- `/_authenticated/$slug/payments/payouts`
- `/_authenticated/$slug/payments/balances`
- `/_authenticated/$slug/payments/disputes`
- `/_authenticated/$slug/payments/tax`
- `/_authenticated/$slug/payments/subscriptions`

And that old settings routes are removed:

- NO `/_authenticated/$slug/settings/payment-history`
- NO `/_authenticated/$slug/settings/payouts`
- NO `/_authenticated/$slug/settings/balances`
- NO `/_authenticated/$slug/settings/disputes`
- NO `/_authenticated/$slug/settings/tax-documents`

**Step 5: Fix any issues found**

If typecheck/lint/build fail, fix the issues and re-run.

**Step 6: Commit generated route tree**

```bash
git add apps/web/src/routeTree.gen.ts
git commit -m "chore: update generated route tree for payments routes"
```

---

### Task 9: Push to staging

**Step 1: Push all commits**

Run: `git push origin staging`
Expected: All commits pushed successfully

---

## Summary of Changes

| Area        | What Changed                                                                                                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar** | New "Payments" section with CreditCard icon between Workspace and Settings. 7 items: Overview, Subscriptions, History, Payouts, Balances, Disputes, Tax Documents. Existing "Payments" in Settings renamed to "retired provider Connect". |
| **Routes**  | 8 new route files under `payments/`. 5 old settings routes deleted. 1 layout route.                                                                                                                                                       |
| **Backend** | 2 new query files: `revenue_queries.ts` (stats + transactions), `subscription_queries.ts` (active subscriptions). 1 new action file: `subscription_actions.ts` (pause/resume/cancel).                                                     |
| **Pages**   | Payments Overview with 4 revenue cards + filterable transaction table. Subscriptions page with pause/resume/cancel. 5 moved retired provider Connect pages.                                                                               |
