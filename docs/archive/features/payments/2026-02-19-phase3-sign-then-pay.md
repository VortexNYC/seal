# Phase 3: Inline Payment on Signing Page (Sign-then-Pay)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the redirect-based "Pay Now" link (to retired provider hosted invoice URL) with an inline `PaymentElement` on the signing page, introducing a `waiting_for_payment` workflow status so that documents don't complete until payment is collected.

**Architecture:** Sign-then-Pay model — all signers sign first, then the designated payer sees an inline `PaymentElement` powered by retired provider's `confirmation_secret` expansion on finalized invoices. The `invoice.paid` webhook triggers the final `waiting_for_payment → completed` transition.

**Tech Stack:** retired provider PaymentElement (`@retired_provider/react-retired_provider-js`), Convex actions/mutations/queries, retired provider `confirmation_secret` API, existing Connect webhook pipeline.

---

## Pre-Implementation Context

### Approved Decisions (from gap analysis)

| Hole                                     | Decision                                              | Option |
| ---------------------------------------- | ----------------------------------------------------- | ------ |
| 1. `waiting_for_payment` cascades        | Full new workflow status                              | A      |
| 2. Shared `retrieveClientSecret` helper  | Extract into `payment_field_actions.ts`               | A      |
| 3. `send_invoice` + PaymentIntent        | Confirmed NOT a blocker — `confirmation_secret` works | —      |
| 4. `client_secret` storage               | On-demand retrieval (no DB storage)                   | B      |
| 5. Signing page auth for `client_secret` | New public action `getPaymentSecret` with token auth  | A      |
| 6. Multi-signer timing                   | Payment after ALL signers complete                    | A      |

### Key retired provider API Facts (validated via retired provider MCP)

- When an invoice is finalized, retired provider creates a PaymentIntent automatically
- Use `expand: ['confirmation_secret']` on `retired_provider.invoices.retrieve()` to get the PI's `client_secret`
- The `client_secret` is NOT stored in the DB — retrieved on-demand per retired provider's security guidance
- `invoice.paid` webhook fires for all payment types (preferred over `invoice.payment_succeeded`)
- PaymentElement works with connected accounts via `retired_providerAccount` header

### Files Overview

**New files to create:**
| File | Purpose |
|------|---------|
| `apps/web/src/components/documents/field-inputs/payment-field-inline.tsx` | Inline PaymentElement component for signing page |

**Files to modify:**
| File | Changes |
|------|---------|
| `apps/backend/convex/schemas/document_workflow_status.ts` | Add `waiting_for_payment` to enum, transitions, labels |
| `apps/backend/convex/documents/workflow_helpers.ts` | Update `canCompleteDocument`, `isTerminalWorkflowStatus` |
| `apps/backend/convex/documents/workflow_mutations.ts` | Check payment fields before completing → route to `waiting_for_payment` |
| `apps/backend/convex/retired_provider/payment_field_actions.ts` | Extract `retrieveClientSecret` helper |
| `apps/backend/convex/retired_provider/connect_webhook_handlers.ts` | Add document completion check after `invoice.paid` |
| `apps/backend/convex/payment_fields/mutations.ts` | Return `documentId` from `updatePaymentStatusFromWebhook` |
| `apps/backend/convex/payment_fields/queries.ts` | Add `getPaymentSecret` public action (or new action file) |
| `apps/web/src/components/documents/workflow-status-badge.tsx` | Add `waiting_for_payment` badge config |
| `apps/web/src/components/documents/document-status-hero.tsx` | Add `waiting_for_payment` status styles |
| `apps/web/src/lib/formatting.ts` | Add `waiting_for_payment` label |
| `apps/web/src/components/documents/field-inputs/payment-field-summary.tsx` | Replace "Pay Now" link with inline PaymentElement |
| `apps/web/src/components/documents/field-inputs/index.ts` | Export new component |
| `apps/web/src/components/documents/field-input-manager.tsx` | Wire up inline payment component |

---

## Task 1: Add `waiting_for_payment` to Workflow Status Schema

**Files:**

- Modify: `apps/backend/convex/schemas/document_workflow_status.ts`

**Step 1: Add the new status literal to the union**

In `document_workflow_status.ts`, add `v.literal("waiting_for_payment")` to the union:

```typescript
export const documentWorkflowStatusTuple = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("in_progress"),
  v.literal("waiting_for_payment"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("declined"),
);
```

**Step 2: Update the transitions map**

Add `waiting_for_payment` transitions:

- `in_progress` can now transition to `waiting_for_payment`
- `waiting_for_payment` can transition to `completed` or `cancelled`

```typescript
export const WORKFLOW_TRANSITIONS: Record<DocumentWorkflowStatus, DocumentWorkflowStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["in_progress", "cancelled", "declined"],
  in_progress: ["completed", "waiting_for_payment", "cancelled", "declined"],
  waiting_for_payment: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  declined: [],
};
```

**Step 3: Update the labels map**

```typescript
export function getWorkflowStatusLabel(status: DocumentWorkflowStatus): string {
  const labels: Record<DocumentWorkflowStatus, string> = {
    draft: "Draft",
    sent: "Sent",
    in_progress: "In Progress",
    waiting_for_payment: "Awaiting Payment",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Declined",
  };
  return labels[status];
}
```

**Step 4: Update the JSDoc comment**

Add `waiting_for_payment` to the docstring at the top of the file.

**Step 5: Verify**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: Compile errors in other files that reference `DocumentWorkflowStatus` exhaustively (switch/case, Record types) — these will be fixed in subsequent tasks.

---

## Task 2: Update Workflow Helper Functions

**Files:**

- Modify: `apps/backend/convex/documents/workflow_helpers.ts`

**Step 1: Update `isTerminalWorkflowStatus`**

`waiting_for_payment` is NOT terminal — it can transition to `completed`:

```typescript
export function isTerminalWorkflowStatus(status: DocumentWorkflowStatus): boolean {
  return status === "completed" || status === "cancelled" || status === "declined";
}
```

No change needed — `waiting_for_payment` is already not in the list. Just verify this is correct.

**Step 2: Update `canCompleteDocument`**

Allow completion from both `in_progress` and `waiting_for_payment`:

```typescript
export function canCompleteDocument(status: DocumentWorkflowStatus): boolean {
  return status === "in_progress" || status === "waiting_for_payment";
}
```

**Step 3: Update `canCancelDocument`**

Already uses `!isTerminalWorkflowStatus()` — `waiting_for_payment` is correctly cancellable. No change needed.

**Step 4: Update `transitionWorkflowStatus`**

No change needed — it uses the `WORKFLOW_TRANSITIONS` map from Task 1. But the `switch` for timestamps doesn't handle `waiting_for_payment`. We don't need a special timestamp for this status (no `waitingForPaymentAt` field), so no change required.

**Step 5: Verify**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`

---

## Task 3: Update Frontend Status Displays

**Files:**

- Modify: `apps/web/src/components/documents/workflow-status-badge.tsx`
- Modify: `apps/web/src/components/documents/document-status-hero.tsx`
- Modify: `apps/web/src/lib/formatting.ts`

**Step 1: Update `workflow-status-badge.tsx`**

Add `waiting_for_payment` to the `DocumentWorkflowStatus` type and status config:

```typescript
export type DocumentWorkflowStatus =
  | "draft"
  | "sent"
  | "in_progress"
  | "waiting_for_payment"
  | "completed"
  | "cancelled"
  | "declined";
```

Add to `STATUS_CONFIG`:

```typescript
waiting_for_payment: {
  label: "Awaiting Payment",
  variant: "secondary", // or "outline" — matches the amber/warning visual
  icon: CreditCard,     // from lucide-react
},
```

**Step 2: Update `document-status-hero.tsx`**

Add `waiting_for_payment` case to `getStatusStyles()`:

```typescript
case "waiting_for_payment":
  return {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-200",
    icon: <CreditCard className="h-5 w-5" />,
    title: "Awaiting Payment",
    description: "All signatures collected. Payment is pending.",
  };
```

**Step 3: Update `formatting.ts`**

Add `waiting_for_payment` to the `getStatusLabel` function's type union and switch/record:

```typescript
export function getStatusLabel(
  status:
    | "draft"
    | "sent"
    | "in_progress"
    | "waiting_for_payment"
    | "completed"
    | "cancelled"
    | "declined"
    | undefined,
): string {
```

Add the case:

```typescript
waiting_for_payment: "Awaiting Payment",
```

**Step 4: Grep for other exhaustive references**

Search for any other files with exhaustive `DocumentWorkflowStatus` handling:

```bash
cd /Users/shlomokabareti/Projects/Seal && grep -rn "in_progress.*completed.*cancelled.*declined" apps/web/src/ apps/backend/convex/ --include="*.ts" --include="*.tsx" | head -30
```

Fix any remaining exhaustiveness errors.

**Step 5: Verify**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`
Expected: Zero type errors.

**Step 6: Commit**

```bash
git add apps/backend/convex/schemas/document_workflow_status.ts apps/backend/convex/documents/workflow_helpers.ts apps/web/src/components/documents/workflow-status-badge.tsx apps/web/src/components/documents/document-status-hero.tsx apps/web/src/lib/formatting.ts
git commit -m "feat: add waiting_for_payment workflow status for sign-then-pay flow"
```

---

## Task 4: Modify Workflow Completion to Check Payment Fields

**Files:**

- Modify: `apps/backend/convex/documents/workflow_mutations.ts` (lines ~330-392, `checkAndCompleteWorkflow`)

**Step 1: Add payment field check before completing**

After the "all recipients completed" check (line 350), before transitioning to `completed`, query for payment field configs:

```typescript
// 5. All recipients completed — check for unpaid payment fields
const paymentConfigs = await ctx.db
  .query("payment_field_configs")
  .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
  .collect();

const hasUnpaidPayments = paymentConfigs.some(
  (config) => config.paymentStatus !== "paid" && config.paymentStatus !== "cancelled",
);

if (hasUnpaidPayments) {
  // Route to waiting_for_payment instead of completed
  await ctx.db.patch(args.documentId, {
    workflowStatus: "waiting_for_payment",
    updatedAt: Date.now(),
  });

  // Still cancel reminders
  // ... (existing reminder cancellation code stays)

  return {
    success: true,
    completed: false,
    reason: "waiting_for_payment",
    remindersCancelled: activeReminders.length,
  };
}

// 6. No payment fields (or all paid) — mark as completed
await ctx.db.patch(args.documentId, {
  workflowStatus: "completed",
  completedAt: Date.now(),
  updatedAt: Date.now(),
});
```

**Step 2: Verify the return type**

The `checkAndCompleteWorkflow` mutation returns `{ success, completed, reason?, remindersCancelled? }`. Adding `reason: "waiting_for_payment"` and `completed: false` follows the existing pattern (like `reason: "pending_recipients"`).

**Step 3: Verify**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`

**Step 4: Commit**

```bash
git add apps/backend/convex/documents/workflow_mutations.ts
git commit -m "feat: route to waiting_for_payment when document has unpaid payment fields"
```

---

## Task 5: Add `getPaymentSecret` Action for Signing Page

**Files:**

- Create or modify: `apps/backend/convex/retired_provider/payment_field_actions.ts`

This is the critical action that retrieves the `client_secret` on-demand from retired provider for the PaymentElement. It uses token-based authentication (same as the signing page) rather than requiring a logged-in user.

**Step 1: Add the `getPaymentSecret` public action**

Add to `payment_field_actions.ts` (or a new `payment_field_public_actions.ts` to keep the file manageable — the current file is 1041 lines):

```typescript
/**
 * Retrieve the payment client_secret for an invoice, authenticated by recipient token.
 *
 * Called from the signing page when a signer needs to pay inline.
 * Uses retired provider's `confirmation_secret` expansion to get the PI's client_secret
 * without storing it in the DB (per retired provider's security guidance).
 */
export const getPaymentSecret = action({
  args: {
    token: v.string(),
    configId: v.id("payment_field_configs"),
  },
  handler: async (ctx, { token, configId }) => {
    // 1. Validate the recipient token
    const recipient = await ctx.runQuery(internal.recipients.queries.findRecipientByToken, {
      token,
    });
    if (!recipient) {
      throw new ConvexError("Invalid or expired token");
    }

    // 2. Get the payment config
    const config = await ctx.runQuery(
      internal.payment_fields.queries.getPaymentConfigByFieldInternal,
      { configId },
    );
    if (!config) {
      throw new ConvexError("Payment configuration not found");
    }

    // 3. Verify the recipient belongs to the same document as the payment config
    if (recipient.documentId !== config.documentId) {
      throw new ConvexError("Payment config does not belong to this document");
    }

    // 4. Verify payment is in a payable state
    if (config.paymentStatus === "paid" || config.paymentStatus === "cancelled") {
      throw new ConvexError("Payment is already completed or cancelled");
    }

    if (!config.retired_providerInvoiceId) {
      throw new ConvexError("Invoice not yet created");
    }

    // 5. Get the connected account's retired provider account ID
    const retired_providerAccount = await ctx.runQuery(internal.retired_provider.connect_mutations.getAccountByOrgId, {
      organizationId: config.organizationId,
    });
    if (!retired_providerAccount?.retired_providerAccountId) {
      throw new ConvexError("retired provider account not found for this organization");
    }

    // 6. Retrieve the invoice with confirmation_secret expansion
    const retired_provider = initializeretired provider();
    const invoice = await retired_provider.invoices.retrieve(
      config.retired_providerInvoiceId,
      { expand: ["confirmation_secret"] },
      { retired_providerAccount: retired_providerAccount.retired_providerAccountId },
    );

    // The confirmation_secret contains the PaymentIntent's client_secret
    const clientSecret = (
      invoice as retired provider.Invoice & { confirmation_secret?: { client_secret: string } }
    ).confirmation_secret?.client_secret;

    if (!clientSecret) {
      throw new ConvexError("Unable to retrieve payment secret — invoice may not be finalized");
    }

    return {
      clientSecret,
      retired_providerAccountId: retired_providerAccount.retired_providerAccountId,
    };
  },
});
```

**Step 2: Add internal query for config lookup**

In `apps/backend/convex/payment_fields/queries.ts`, add:

```typescript
export const getPaymentConfigByFieldInternal = internalQuery({
  args: {
    configId: v.id("payment_field_configs"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.configId);
  },
});
```

**Step 3: Add internal query for retired provider account by org**

Check if `getAccountByOrgId` already exists in `connect_mutations.ts`. If not, add it:

```typescript
export const getAccountByOrgId = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("retired_provider_accounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();
  },
});
```

**Step 4: Verify**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`

**Step 5: Commit**

```bash
git add apps/backend/convex/retired_provider/payment_field_actions.ts apps/backend/convex/payment_fields/queries.ts
# Also add connect_mutations.ts if modified
git commit -m "feat: add getPaymentSecret action for inline payment on signing page"
```

---

## Task 6: Extend `invoice.paid` Webhook to Complete Documents

**Files:**

- Modify: `apps/backend/convex/retired_provider/connect_webhook_handlers.ts`
- Modify: `apps/backend/convex/payment_fields/mutations.ts`

When `invoice.paid` fires:

1. Update the payment config status to `paid` (already works)
2. Check if ALL payment configs for the document are now paid
3. If yes AND document is `waiting_for_payment`, transition to `completed`

**Step 1: Return `documentId` from `updatePaymentStatusFromWebhook`**

In `apps/backend/convex/payment_fields/mutations.ts`, modify the return to include `documentId`:

```typescript
export const updatePaymentStatusFromWebhook = internalMutation({
  args: {
    retired_providerInvoiceId: v.string(),
    paymentStatus: paymentStatusTuple,
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_retired_provider_invoice", (q) =>
        q.eq("retired_providerInvoiceId", args.retired_providerInvoiceId),
      )
      .first();

    if (!config) {
      return null;
    }

    await ctx.db.patch(config._id, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });

    return { configId: config._id, documentId: config.documentId };
  },
});
```

**Step 2: Add document completion check in `handleInvoicePaid`**

In `connect_webhook_handlers.ts`, after updating the payment status, check if the document should now complete:

```typescript
async function handleInvoicePaid(ctx: HttpActionCtx, invoice: retired provider.Invoice): Promise<void> {
  console.info("Processing invoice.paid webhook", {
    operation: "retired_providerConnect.invoicePaid",
    retired_providerInvoiceId: invoice.id,
    status: invoice.status,
    amountPaid: invoice.amount_paid,
  });

  // Update payment_field_configs (new system)
  const result = await updatePaymentFieldFromInvoice(ctx, invoice, "paid");

  // If a payment config was updated, check if the document can now complete
  if (result?.documentId) {
    await ctx.runMutation(internal.documents.workflow_mutations.checkPaymentCompletionAndFinalize, {
      documentId: result.documentId,
    });
  }
}
```

**Step 3: Update `updatePaymentFieldFromInvoice` return type**

The helper currently returns `string | null`. Update it to return `{ configId: string, documentId: string } | null`:

```typescript
async function updatePaymentFieldFromInvoice(
  ctx: HttpActionCtx,
  invoice: retired provider.Invoice,
  paymentStatus: PaymentStatus,
): Promise<{ configId: string; documentId: string } | null> {
  const result = await ctx.runMutation(
    internal.payment_fields.mutations.updatePaymentStatusFromWebhook,
    {
      retired_providerInvoiceId: invoice.id,
      paymentStatus,
    },
  );

  if (result) {
    console.info("Payment field config status updated", {
      operation: "retired_providerConnect.paymentFieldUpdate",
      retired_providerInvoiceId: invoice.id,
      paymentStatus,
      configId: result.configId,
      documentId: result.documentId,
    });
  }

  return result;
}
```

**Step 4: Add `checkPaymentCompletionAndFinalize` internal mutation**

In `apps/backend/convex/documents/workflow_mutations.ts`, add a new internal mutation:

```typescript
/**
 * Check if all payment fields for a document are paid,
 * and if the document is in waiting_for_payment, transition to completed.
 *
 * Called from invoice.paid webhook handler.
 */
export const checkPaymentCompletionAndFinalize = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) return { completed: false, reason: "document_not_found" };

    // Only act on documents in waiting_for_payment
    if (document.workflowStatus !== "waiting_for_payment") {
      return { completed: false, reason: "not_waiting_for_payment" };
    }

    // Check all payment configs for this document
    const paymentConfigs = await ctx.db
      .query("payment_field_configs")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const allPaid = paymentConfigs.every(
      (config) => config.paymentStatus === "paid" || config.paymentStatus === "cancelled",
    );

    if (!allPaid) {
      return { completed: false, reason: "payments_pending" };
    }

    // All payments collected — complete the document
    await ctx.db.patch(args.documentId, {
      workflowStatus: "completed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Publish webhook event
    await publishWebhookEvent(ctx, {
      organizationId: document.organizationId,
      eventType: "document.completed",
      data: {
        document_id: args.documentId,
        name: document.name,
        completed_at: new Date().toISOString(),
      },
    });

    return { completed: true };
  },
});
```

**Step 5: Verify**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`

**Step 6: Commit**

```bash
git add apps/backend/convex/retired_provider/connect_webhook_handlers.ts apps/backend/convex/payment_fields/mutations.ts apps/backend/convex/documents/workflow_mutations.ts
git commit -m "feat: complete document when all payments collected via invoice.paid webhook"
```

---

## Task 7: Create Inline PaymentElement Component

**Files:**

- Create: `apps/web/src/components/documents/field-inputs/payment-field-inline.tsx`
- Modify: `apps/web/src/components/documents/field-inputs/payment-field-summary.tsx`
- Modify: `apps/web/src/components/documents/field-inputs/index.ts`

**Step 1: Create `payment-field-inline.tsx`**

This component:

1. Fetches the `client_secret` from `getPaymentSecret` action
2. Initializes retired provider.js with the connected account
3. Renders PaymentElement
4. Handles `retired_provider.confirmPayment()` on submit

```typescript
import { Elements, PaymentElement, useElements, useretired provider } from "@retired_provider/react-retired_provider-js";
import { type retired provider as retired providerType, loadretired provider } from "@retired_provider/retired_provider-js";
import { useAction } from "convex/react";
import { CreditCardIcon, Loader2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

interface PaymentFieldInlineProps {
  configId: Id<"payment_field_configs">;
  token: string;
  totalAmountCents: number;
  currency: string;
}

/**
 * Inline payment form using retired provider PaymentElement.
 * Fetches client_secret on-demand and renders payment UI.
 */
export function PaymentFieldInline({
  configId,
  token,
  totalAmountCents,
  currency,
}: PaymentFieldInlineProps) {
  const getPaymentSecret = useAction(api.retired_provider.payment_field_actions.getPaymentSecret);
  const [retired_providerPromise, setretired providerPromise] = useState<Promise<retired providerType | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function fetchSecret() {
      try {
        const result = await getPaymentSecret({ token, configId });
        setClientSecret(result.clientSecret);
        // Initialize retired provider with connected account
        setretired providerPromise(
          loadretired provider(import.meta.env.VITE_RETIRED_PROVIDER_PUBLISHABLE_KEY as string, {
            retired_providerAccount: result.retired_providerAccountId,
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payment form");
      } finally {
        setLoading(false);
      }
    }
    fetchSecret();
  }, [getPaymentSecret, token, configId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2Icon className="text-muted-foreground h-5 w-5 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Loading payment form...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!clientSecret || !retired_providerPromise) {
    return null;
  }

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(totalAmountCents / 100);

  return (
    <Elements
      retired_provider={retired_providerPromise}
      options={{
        clientSecret,
        appearance: {
          theme: "retired_provider",
          variables: {
            borderRadius: "8px",
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          },
        },
      }}
    >
      <PaymentForm amount={formattedAmount} />
    </Elements>
  );
}

function PaymentForm({ amount }: { amount: string }) {
  const retired_provider = useretired provider();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!retired_provider || !elements) return;

      setIsSubmitting(true);
      try {
        const { error: retired_providerError } = await retired_provider.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.href,
          },
          redirect: "if_required",
        });

        if (retired_providerError) {
          toast.error(retired_providerError.message ?? "Payment failed");
        } else {
          toast.success("Payment successful!");
        }
      } catch (err) {
        toast.error("An unexpected error occurred");
        console.error("Payment error:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [retired_provider, elements],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!retired_provider || !elements || isSubmitting}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {isSubmitting ? (
          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCardIcon className="mr-2 h-4 w-4" />
        )}
        {isSubmitting ? "Processing..." : `Pay ${amount}`}
      </Button>
    </form>
  );
}
```

**Step 2: Update `payment-field-summary.tsx` to conditionally render inline payment**

Replace the "Pay Now" link with the inline PaymentElement when the document is in `waiting_for_payment` state. The `PaymentFieldSummary` component needs to know whether to show inline payment or just a summary. Add props for this:

```typescript
interface PaymentFieldSummaryProps {
  fieldId: Id<"signature_fields">;
  /** Recipient token for payment authentication (signing page only) */
  token?: string;
  /** Whether to show inline payment form instead of "Pay Now" link */
  showInlinePayment?: boolean;
}
```

Replace the "Pay Now" link section (lines 107-120) with:

```typescript
{/* Inline payment form (when on signing page with active payment) */}
{showInlinePayment && token && config.paymentStatus !== "paid" &&
  config.paymentStatus !== "cancelled" && config.paymentStatus !== "failed" && (
  <PaymentFieldInline
    configId={config._id}
    token={token}
    totalAmountCents={config.totalAmountCents}
    currency={config.currency}
  />
)}

{/* Fallback: Pay Now link (when inline is not available) */}
{!showInlinePayment && config.hostedInvoiceUrl &&
  config.paymentStatus !== "paid" &&
  config.paymentStatus !== "cancelled" &&
  config.paymentStatus !== "failed" && (
  <a
    href={config.hostedInvoiceUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-1 inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
  >
    Pay Now &rarr;
  </a>
)}
```

**Step 3: Update exports in `index.ts`**

```typescript
export { PaymentFieldInline } from "./payment-field-inline";
```

**Step 4: Update `field-input-manager.tsx`**

Pass the `token` and `showInlinePayment` props to `PaymentFieldSummary` when rendering on the signing page. The field-input-manager needs to detect whether it's on the signing page (has a token) and whether the document is in `waiting_for_payment`.

**Step 5: Verify**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`

**Step 6: Commit**

```bash
git add apps/web/src/components/documents/field-inputs/payment-field-inline.tsx apps/web/src/components/documents/field-inputs/payment-field-summary.tsx apps/web/src/components/documents/field-inputs/index.ts apps/web/src/components/documents/field-input-manager.tsx
git commit -m "feat: add inline PaymentElement for signing page payment flow"
```

---

## Task 8: Wire Up Signing Page to Show Inline Payment

**Files:**

- Modify: `apps/web/src/routes/sign.$token.tsx`

The signing page already queries `payment_field_configs` (line 113). When the document is in `waiting_for_payment` state:

1. Show a banner: "All signatures collected. Please complete payment below."
2. Render `PaymentFieldSummary` with `showInlinePayment={true}` and `token={token}`
3. After successful payment, the `invoice.paid` webhook handles the transition automatically — the Convex reactive query will update the UI in real-time.

**Step 1: Pass token and payment context to field rendering**

The signing page renders fields through `field-input-manager`. Thread through:

- `token` from the URL params
- `showInlinePayment` based on document `workflowStatus === "waiting_for_payment"`

**Step 2: Add payment banner**

When `document.workflowStatus === "waiting_for_payment"`, show a prominent banner above the payment fields.

**Step 3: Verify**

Run: `cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck`

**Step 4: Commit**

```bash
git add apps/web/src/routes/sign.$token.tsx
git commit -m "feat: show inline payment form on signing page for waiting_for_payment documents"
```

---

## Task 9: Final Verification and Cleanup

**Step 1: Full typecheck**

```bash
cd /Users/shlomokabareti/Projects/Seal && bun --bun run typecheck
```

**Step 2: Full lint**

```bash
cd /Users/shlomokabareti/Projects/Seal && bun --bun run lint
```

**Step 3: Search for any remaining references**

Grep for any files that might need `waiting_for_payment` awareness:

```bash
grep -rn "workflowStatus" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v _generated
```

Review each hit to ensure `waiting_for_payment` is handled or intentionally excluded.

**Step 4: Format**

```bash
cd /Users/shlomokabareti/Projects/Seal && bun --bun run format
```

**Step 5: Commit any cleanup**

```bash
git add -A && git commit -m "chore: Phase 3 cleanup and formatting"
```

---

## Manual Testing Checklist

1. **Free plan user**: Verify payment settings page shows "Pro Required" (unchanged)
2. **Pro plan with retired provider Connect**: Create a document with a payment field
3. **Send document**: Verify invoices are created on retired provider (unchanged)
4. **Sign document (all signers)**: After last signer completes, document should transition to `waiting_for_payment` (NOT `completed`)
5. **Signing page for payer**: Should show "Awaiting Payment" banner + inline PaymentElement
6. **Complete payment**: Enter test card `4242424242424242`, complete payment inline
7. **After payment**: Document should transition to `completed` (via `invoice.paid` webhook)
8. **Document list**: Should show "Awaiting Payment" badge for documents in that state
9. **Cancel from `waiting_for_payment`**: Owner should be able to cancel the document
10. **Failed payment**: Test with `4000000000000002` (declined card) — should show error inline, document stays in `waiting_for_payment`

---

## NOT in Scope

- Phase 4: Connect account dashboard stats pages (payments, payouts, balances)
- Email notification for "all signed, now pay" (can be added as follow-up)
- Recurring/subscription payment inline handling (currently only one-time invoices get inline payment)
- Dark mode for PaymentElement on signing page (signing page doesn't have dark mode toggle)
