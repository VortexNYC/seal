# Document Expiration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow senders to set an expiration period on documents so unsigned documents automatically expire, recipients are blocked from signing after expiry, and senders can re-send expired documents.

**Architecture:** Schema-first approach — add "expired" status to workflow + recipient status tuples, add `expirationPeriod` to documents and `expiresAt` to recipients. A 15-minute sweep cron enforces expiry. The signing page gates access instantly via `expiresAt` check. The send dialog replaces the raw calendar picker with a preset dropdown.

**Tech Stack:** Convex (backend mutations/actions/crons), React 19 + TanStack Router (frontend), Shadcn UI components, React Email (transactional templates), vitest + convex-test (unit tests)

**Design doc:** `docs/plans/2026-02-25-document-expiration-design.md`

---

### Task 1: Add "expired" to document workflow status schema

**Files:**

- Modify: `apps/backend/convex/schemas/document_workflow_status.ts`

**Step 1: Add "expired" literal to the union (line 16–24)**

Add `v.literal("expired")` to `documentWorkflowStatusTuple`:

```typescript
export const documentWorkflowStatusTuple = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("in_progress"),
  v.literal("waiting_for_payment"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("declined"),
  v.literal("expired")
);
```

**Step 2: Update WORKFLOW_TRANSITIONS (line 31–39)**

Add `"expired"` as valid target from `sent` and `in_progress`, add `expired → sent` for re-send, and add terminal `expired` entry:

```typescript
export const WORKFLOW_TRANSITIONS: Record<
  DocumentWorkflowStatus,
  DocumentWorkflowStatus[]
> = {
  draft: ["sent", "cancelled"],
  sent: ["in_progress", "cancelled", "declined", "expired"],
  in_progress: [
    "completed",
    "waiting_for_payment",
    "cancelled",
    "declined",
    "expired",
  ],
  waiting_for_payment: ["completed", "cancelled"],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
  declined: [], // Terminal state
  expired: ["sent"], // Can be re-sent
};
```

**Step 3: Update getWorkflowStatusLabel (line 54–65)**

Add `expired: "Expired"` to the labels record.

**Step 4: Verify**

Run: `cd apps/backend && bun --bun run typecheck`
Expected: Should pass (type system ensures all cases handled)

**Step 5: Commit**

```bash
git add apps/backend/convex/schemas/document_workflow_status.ts
git commit -m "feat: add 'expired' to document workflow status schema"
```

---

### Task 2: Add "expired" to recipient status + new fields on recipients table

**Files:**

- Modify: `apps/backend/convex/schemas/recipients.ts`

**Step 1: Add "expired" to recipientStatusTuple (line 23–28)**

```typescript
export const recipientStatusTuple = v.union(
  v.literal("pending"),
  v.literal("viewed"),
  v.literal("signed"),
  v.literal("declined"),
  v.literal("expired")
);
```

**Step 2: Add expiresAt and expirationNotifiedAt to recipientsTable (after line 61)**

After `reminderCount`, add:

```typescript
  // Expiration enforcement
  expiresAt: v.optional(v.number()),            // Timestamp when this recipient's access expires
  expirationNotifiedAt: v.optional(v.number()), // When expiration notification was sent (idempotency)
```

**Step 3: Verify**

Run: `cd apps/backend && bun --bun run typecheck`
Expected: May surface type errors in components using `RecipientStatus` — those will be fixed in later tasks.

**Step 4: Commit**

```bash
git add apps/backend/convex/schemas/recipients.ts
git commit -m "feat: add 'expired' recipient status and expiresAt fields"
```

---

### Task 3: Add expirationPeriod to documents schema + audit log actions

**Files:**

- Modify: `apps/backend/convex/schemas/documents.ts`
- Modify: `apps/backend/convex/schemas/audit_logs.ts`

**Step 1: Add expirationPeriod to documentsTable (after line 88, near deadline)**

After `expirationAlertsSent`:

```typescript
  // Document expiration configuration (amount + unit for computing per-recipient expiresAt)
  expirationPeriod: v.optional(v.object({
    amount: v.number(),
    unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
  })),

  // Expiration workflow timestamp
  expiredAt: v.optional(v.number()),
```

**Step 2: Add audit actions (in audit_logs.ts, line 15–67)**

Add after `v.literal("document.cancelled"),` (line 24):

```typescript
  v.literal("document.expired"),
```

Add after `v.literal("recipient.esign_opt_out"),` (line 38):

```typescript
  v.literal("recipient.expired"),
```

**Step 3: Verify**

Run: `cd apps/backend && bun --bun run typecheck`

**Step 4: Commit**

```bash
git add apps/backend/convex/schemas/documents.ts apps/backend/convex/schemas/audit_logs.ts
git commit -m "feat: add expirationPeriod to documents schema, audit actions for expiration"
```

---

### Task 4: Update workflow helpers to handle "expired" status

**Files:**

- Modify: `apps/backend/convex/documents/workflow_helpers.ts`

**Step 1: Update isTerminalWorkflowStatus (line 73–75)**

```typescript
export function isTerminalWorkflowStatus(
  status: DocumentWorkflowStatus
): boolean {
  return (
    status === "completed" ||
    status === "cancelled" ||
    status === "declined" ||
    status === "expired"
  );
}
```

**Step 2: Update transitionWorkflowStatus to handle expiredAt timestamp (line 38–68)**

Add `expiredAt?: number;` to the `updateData` type, and add a case for `"expired"`:

```typescript
const updateData: {
  workflowStatus: DocumentWorkflowStatus;
  updatedAt: number;
  sentAt?: number;
  completedAt?: number;
  cancelledAt?: number;
  declinedAt?: number;
  expiredAt?: number;
} = {
  workflowStatus: newStatus,
  updatedAt: Date.now(),
};

const now = Date.now();
switch (newStatus) {
  case "sent":
    updateData.sentAt = now;
    break;
  case "completed":
    updateData.completedAt = now;
    break;
  case "cancelled":
    updateData.cancelledAt = now;
    break;
  case "declined":
    updateData.declinedAt = now;
    break;
  case "expired":
    updateData.expiredAt = now;
    break;
}
```

**Step 3: Update canCancelDocument to include expired (line 87–89)**

Expired documents can also be cancelled (before re-send), but `isTerminalWorkflowStatus` now includes expired. Actually, the existing logic `!isTerminalWorkflowStatus(status)` already means expired docs can't be cancelled. This is correct — to "undo" expiration, the sender re-sends (which transitions `expired → sent`).

No change needed here — just verify the logic is correct.

**Step 4: Verify**

Run: `cd apps/backend && bun --bun run typecheck`

**Step 5: Commit**

```bash
git add apps/backend/convex/documents/workflow_helpers.ts
git commit -m "feat: update workflow helpers for expired status handling"
```

---

### Task 5: Update workflow helpers tests

**Files:**

- Modify: `apps/backend/convex/documents/__tests__/workflow_helpers.test.ts`

**Step 1: Add "expired" to isTerminalWorkflowStatus test (line 18–28)**

Add `["expired", true]` to the test.each array.

**Step 2: Add "expired" to canSendDocument false cases (line 36–45)**

Add `"expired"` to the test.each array.

**Step 3: Add "expired" to canCancelDocument false cases (line 56–61)**

Add `"expired"` to the terminal status test.each array.

**Step 4: Add "expired" to canCompleteDocument false cases (line 72–77)**

Add `"expired"` to the test.each array.

**Step 5: Add transition test: sent → expired**

```typescript
test("sent -> expired sets expiredAt timestamp", async () => {
  await t.run(async (ctx) => {
    await transitionWorkflowStatus(ctx, documentId, "sent");
  });
  await t.run(async (ctx) => {
    await transitionWorkflowStatus(ctx, documentId, "expired");
  });

  const doc = await t.run(async (ctx) => {
    return await ctx.db.get(documentId);
  });

  expect(doc).not.toBeNull();
  expect(doc!.workflowStatus).toBe("expired");
  expect(doc!.expiredAt).toBeTypeOf("number");
});
```

**Step 6: Add transition test: expired → sent (re-send)**

```typescript
test("expired -> sent re-enables document (re-send flow)", async () => {
  // Transition draft → sent → expired
  await t.run(async (ctx) => {
    await transitionWorkflowStatus(ctx, documentId, "sent");
  });
  await t.run(async (ctx) => {
    await transitionWorkflowStatus(ctx, documentId, "expired");
  });
  // Re-send: expired → sent
  await t.run(async (ctx) => {
    await transitionWorkflowStatus(ctx, documentId, "sent");
  });

  const doc = await t.run(async (ctx) => {
    return await ctx.db.get(documentId);
  });

  expect(doc!.workflowStatus).toBe("sent");
});
```

**Step 7: Run tests**

Run: `cd apps/backend && bun --bun vitest run convex/documents/__tests__/workflow_helpers.test.ts`
Expected: All tests pass including new ones.

**Step 8: Commit**

```bash
git add apps/backend/convex/documents/__tests__/workflow_helpers.test.ts
git commit -m "test: add workflow helpers tests for expired status"
```

---

### Task 6: Compute expiresAt per recipient in send flow

**Files:**

- Modify: `apps/backend/convex/documents/send_document_action.ts`

**Step 1: Add expirationPeriod arg to markDocumentAsSent (line 65–71)**

Add to args:

```typescript
    expirationPeriod: v.optional(v.object({
      amount: v.number(),
      unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
    })),
```

**Step 2: Add conversion helper at top of file (before exports)**

```typescript
/** Convert expiration period to milliseconds */
function expirationPeriodToMs(
  amount: number,
  unit: "day" | "week" | "month"
): number {
  const MS_PER_DAY = 86_400_000;
  switch (unit) {
    case "day":
      return amount * MS_PER_DAY;
    case "week":
      return amount * 7 * MS_PER_DAY;
    case "month":
      return amount * 30 * MS_PER_DAY;
  }
}
```

**Step 3: Compute and patch expiresAt on recipients (in handler, after the sharing loop, before the status patch)**

After the sharing loop ends (line ~143) and before the status patch (line ~154), add:

```typescript
// Compute expiresAt for all recipients if expiration period is set
if (args.expirationPeriod) {
  const now = Date.now();
  const expiresAt =
    now +
    expirationPeriodToMs(
      args.expirationPeriod.amount,
      args.expirationPeriod.unit
    );
  for (const recipient of recipients) {
    await ctx.db.patch(recipient._id, { expiresAt, updatedAt: now });
  }
}
```

**Step 4: Save expirationPeriod on document (in the status patch, line ~154)**

Update the patch to include:

```typescript
await ctx.db.patch(args.documentId, {
  status: "active",
  workflowStatus: "sent",
  sentAt: Date.now(),
  updatedAt: Date.now(),
  ...(args.deadline && { deadline: args.deadline }),
  ...(args.expirationPeriod && { expirationPeriod: args.expirationPeriod }),
  ...(args.signingMode && { signingMode: args.signingMode }),
});
```

**Step 5: Pass expirationPeriod from sendDocumentEmails action**

In `sendDocumentEmails` args (line ~197), add:

```typescript
    expirationPeriod: v.optional(v.object({
      amount: v.number(),
      unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
    })),
```

In the handler where `markDocumentAsSent` is called (line ~395-403), pass it through:

```typescript
await ctx.runMutation(
  internal.documents.send_document_action.markDocumentAsSent,
  {
    documentId: args.documentId,
    deadline: args.deadline,
    userId: senderUser?.clerkId,
    signingMode: args.signingMode,
    expirationPeriod: args.expirationPeriod,
  }
);
```

Also compute `deadline` from `expirationPeriod` if deadline not explicitly set — for existing alert cron compatibility. In the handler, before calling markDocumentAsSent:

```typescript
// Compute deadline from expirationPeriod for alert cron compatibility
let deadline = args.deadline;
if (!deadline && args.expirationPeriod) {
  deadline =
    Date.now() +
    expirationPeriodToMs(
      args.expirationPeriod.amount,
      args.expirationPeriod.unit
    );
}
```

Then pass `deadline` (computed) instead of `args.deadline`.

**Step 6: Verify**

Run: `cd apps/backend && bun --bun run typecheck`

**Step 7: Commit**

```bash
git add apps/backend/convex/documents/send_document_action.ts
git commit -m "feat: compute expiresAt per recipient when sending with expiration period"
```

---

### Task 7: Create expiration sweep cron

**Files:**

- Create: `apps/backend/convex/documents/expiration_sweep.ts`
- Modify: `apps/backend/convex/crons.ts`

**Step 1: Create expiration_sweep.ts**

```typescript
/**
 * Expiration Sweep — runs every 15 minutes to expire recipients past their expiresAt
 * and transition documents to "expired" when all pending recipients have expired.
 */

import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { logDocumentAction } from "../audit_logs/helpers";

/** Maximum recipients to process per cron run (Convex mutation time budget) */
const BATCH_SIZE = 100;

/**
 * Sweep expired recipients and transition documents to expired status.
 * Processes recipients with status "pending" or "viewed" whose expiresAt < now.
 */
export const sweepExpiredRecipients = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find recipients that have expired but haven't been processed yet
    // We query by status "pending" and "viewed" since both should expire
    const pendingRecipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const viewedRecipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_status", (q) => q.eq("status", "viewed"))
      .collect();

    const candidates = [...pendingRecipients, ...viewedRecipients].filter(
      (r) =>
        r.expiresAt !== undefined &&
        r.expiresAt < now &&
        r.expirationNotifiedAt === undefined
    );

    // Process up to BATCH_SIZE
    const toProcess = candidates.slice(0, BATCH_SIZE);
    const affectedDocumentIds = new Set<string>();

    for (const recipient of toProcess) {
      // 1. Set recipient status to "expired"
      await ctx.db.patch(recipient._id, {
        status: "expired",
        expirationNotifiedAt: now,
        updatedAt: now,
      });

      // 2. Log audit event
      const document = await ctx.db.get(recipient.documentId);
      if (document) {
        await logDocumentAction(ctx, {
          organizationId: document.organizationId,
          action: "recipient.expired",
          documentId: recipient.documentId,
          recipientId: recipient._id,
          newValues: { status: "expired", expiresAt: recipient.expiresAt },
          description: `Recipient ${recipient.email} expired (deadline passed)`,
          ipAddress: "system-cron",
        });
      }

      affectedDocumentIds.add(recipient.documentId as string);
    }

    // 3. Check each affected document for full expiration
    for (const docIdStr of affectedDocumentIds) {
      const docId = docIdStr as Doc<"documents">["_id"];
      const document = await ctx.db.get(docId);
      if (!document) continue;

      const currentStatus = document.workflowStatus ?? "draft";
      // Only transition documents that are in "sent" or "in_progress"
      if (currentStatus !== "sent" && currentStatus !== "in_progress") continue;

      const allRecipients = await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", docId))
        .collect();

      // Check if all recipients are in terminal states (signed, expired, declined)
      const allTerminal = allRecipients.every(
        (r) =>
          r.status === "signed" ||
          r.status === "expired" ||
          r.status === "declined"
      );
      const hasExpired = allRecipients.some((r) => r.status === "expired");

      if (allTerminal && hasExpired) {
        // Transition document to "expired"
        await ctx.db.patch(docId, {
          workflowStatus: "expired",
          expiredAt: now,
          updatedAt: now,
        });

        // Audit log
        await logDocumentAction(ctx, {
          organizationId: document.organizationId,
          action: "document.expired",
          documentId: docId,
          newValues: { workflowStatus: "expired" },
          description:
            "Document expired — all pending recipients passed deadline",
          ipAddress: "system-cron",
        });

        // Schedule notification email to sender
        await ctx.scheduler.runAfter(
          0,
          internal.documents.expiration_sweep.notifyDocumentExpired,
          {
            documentId: docId,
          }
        );
      }
    }
  },
});

/**
 * Send notification email to document owner when document expires.
 * Separated as internal action because it calls external email service.
 */
export const notifyDocumentExpired = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      {
        documentId: args.documentId,
      }
    );
    if (!document) return;

    // Get owner info
    const owner = await ctx.runQuery(
      internal.organizations.helpers.getUserById,
      {
        userId: document.ownerId,
      }
    );
    if (!owner?.email) return;

    // Send expiration notification email
    const { sendDocumentExpiredNotification } = await import("./email");
    await sendDocumentExpiredNotification({
      to: owner.email,
      ownerName: owner.name ?? owner.email,
      documentName: document.name,
      expiredAt: document.expiredAt ?? Date.now(),
    });
  },
});
```

**Important:** The `notifyDocumentExpired` function references `sendDocumentExpiredNotification` from `email.ts` — this will be created in Task 10 (email template). For now, the import will fail at typecheck. We'll stub it or create the email function first.

**Step 2: Add missing imports at top of expiration_sweep.ts**

```typescript
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
```

(Add `internalAction` to the server import, `v` from values.)

**Step 3: Register cron in crons.ts (after line 82)**

```typescript
// Sweep expired recipients every 15 minutes
crons.interval(
  "sweep-expired-recipients",
  { minutes: 15 },
  internal.documents.expiration_sweep.sweepExpiredRecipients
);
```

**Step 4: Verify**

Run: `cd apps/backend && bun --bun run typecheck`
Note: May fail on the email import — that's OK, will be resolved in Task 10.

**Step 5: Commit**

```bash
git add apps/backend/convex/documents/expiration_sweep.ts apps/backend/convex/crons.ts
git commit -m "feat: add expiration sweep cron (15min interval) with sender notification"
```

---

### Task 8: Add signing page expiration gate

**Files:**

- Modify: `apps/backend/convex/documents/recipients_queries.ts` (return `expiresAt` in `getRecipientByToken`)
- Modify: `apps/web/src/routes/sign.$token.tsx` (add expiration check before rendering)
- Create: `apps/web/src/components/signing/document-expired-page.tsx`

**Step 1: Return expiresAt from getRecipientByToken (in recipients_queries.ts, line ~166-181)**

Add `expiresAt: recipient.expiresAt,` to the recipient object in the return statement (after `esignConsentAt`):

```typescript
      recipient: {
        _id: recipient._id,
        documentId: recipient.documentId,
        email: recipient.email,
        name: recipient.name,
        role: recipient.role,
        status: recipient.status,
        viewedAt: recipient.viewedAt,
        signedAt: recipient.signedAt,
        approvedAt: recipient.approvedAt,
        declinedAt: recipient.declinedAt,
        signatureData: recipient.signatureData,
        signatureType: recipient.signatureType,
        esignConsentAt: recipient.esignConsentAt,
        expiresAt: recipient.expiresAt,
      },
```

Also return the document owner's name for the expired page. Add to the document return object:

```typescript
      document: {
        _id: document._id,
        name: document.name,
        description: document.description,
        fileType: document.fileType,
        storageId: document.storageId,
        workflowStatus: document.workflowStatus,
        signingMode: document.signingMode,
      },
      // Existing fields...
      // Add owner name for expired page
      ownerName: undefined as string | undefined, // Will be populated below
```

Actually, getting the owner name requires a user lookup. To keep things simple, we can just show "the sender" on the expired page. No need to fetch the owner — the design says show sender's name but not email.

Let's add a lookup for the owner. After getting the document (line ~120), add:

```typescript
// Get owner name for expired page display
const owner = await ctx.db.get(document.ownerId);
const ownerName = owner?.name ?? "the sender";
```

Then add to return:

```typescript
      ownerName,
```

**Step 2: Create DocumentExpiredPage component**

Create `apps/web/src/components/signing/document-expired-page.tsx`:

```tsx
import { ClockIcon } from "lucide-react";

import { SealLogo } from "@/components/seal-logo";

interface DocumentExpiredPageProps {
  ownerName: string;
}

export function DocumentExpiredPage({ ownerName }: DocumentExpiredPageProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-md space-y-6 text-center">
        <SealLogo className="mx-auto h-10 w-auto" />

        <div className="rounded-lg border bg-white p-8 shadow-sm dark:bg-gray-900">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <ClockIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="text-xl font-semibold text-balance">
            This document has expired
          </h1>

          <p className="text-muted-foreground mt-2 text-sm text-pretty">
            The sender set an expiration date that has passed. Please contact{" "}
            <span className="font-medium">{ownerName}</span> for a new signing
            link.
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Add expiration gate in sign.$token.tsx**

In the `SigningPage` component (line ~135), after destructuring `data` (line ~148-155), add the expiration check before the ESIGN consent state:

```tsx
// Expiration gate — block access if recipient's deadline has passed
if (recipient.expiresAt && recipient.expiresAt < Date.now()) {
  return <DocumentExpiredPage ownerName={data.ownerName} />;
}
```

Add the import at the top of the file:

```typescript
import { DocumentExpiredPage } from "@/components/signing/document-expired-page";
```

**Step 4: Verify**

Run: `cd apps/web && bun --bun run typecheck`

**Step 5: Commit**

```bash
git add apps/backend/convex/documents/recipients_queries.ts apps/web/src/components/signing/document-expired-page.tsx apps/web/src/routes/sign.\$token.tsx
git commit -m "feat: add signing page expiration gate with DocumentExpiredPage"
```

---

### Task 9: Replace calendar deadline picker with expiration dropdown

**Files:**

- Modify: `apps/web/src/components/documents/send-document-dialog.tsx`

**Step 1: Replace deadline state with expirationPeriod state (line 80–83)**

Remove:

```typescript
const [deadline, setDeadline] = useState<Date | undefined>(
  defaultDeadlineDays ? addDays(new Date(), defaultDeadlineDays) : undefined
);
```

Replace with:

```typescript
// Expiration period: preset or custom
type ExpirationPreset = "none" | "7" | "14" | "30" | "60" | "90" | "custom";
const [expirationPreset, setExpirationPreset] = useState<ExpirationPreset>(
  defaultDeadlineDays
    ? [7, 14, 30, 60, 90].includes(defaultDeadlineDays)
      ? (String(defaultDeadlineDays) as ExpirationPreset)
      : "custom"
    : "none"
);
const [customAmount, setCustomAmount] = useState(defaultDeadlineDays ?? 30);
const [customUnit, setCustomUnit] = useState<"day" | "week" | "month">("day");
```

**Step 2: Add helper to compute expirationPeriod from state**

```typescript
const getExpirationPeriod = () => {
  if (expirationPreset === "none") return undefined;
  if (expirationPreset === "custom") {
    return { amount: customAmount, unit: customUnit };
  }
  return { amount: Number(expirationPreset), unit: "day" as const };
};

// Compute human-readable expiration text
const getExpirationText = () => {
  const period = getExpirationPeriod();
  if (!period) return null;
  const { amount, unit } = period;
  const unitLabel = amount === 1 ? unit : `${unit}s`;
  return `Recipients will have ${amount} ${unitLabel} to sign after the document is sent`;
};
```

**Step 3: Update handleSend to pass expirationPeriod**

Replace the deadline validation (line 122–129) with:

```typescript
// Validate custom expiration amount
const expirationPeriod = getExpirationPeriod();
if (expirationPeriod && expirationPeriod.amount < 1) {
  toast.error("Expiration period must be at least 1");
  return;
}
```

Update the `sendDocumentEmails` call (line 142–148):

```typescript
const result = await sendDocumentEmails({
  documentId,
  customMessage: customMessage.trim() || undefined,
  recipientMessages:
    perRecipientMessages.length > 0 ? perRecipientMessages : undefined,
  expirationPeriod,
  signingMode: signingMode === "sequential" ? "sequential" : undefined,
});
```

Remove `deadline: deadline?.getTime(),` from the call args.

**Step 4: Replace the calendar UI (lines 370–407)**

Replace the entire `{/* SEA-119: Deadline picker */}` block with:

```tsx
{
  /* Expiration Period */
}
<div>
  <Label className="text-sm font-medium">Expiration (Optional)</Label>
  <p className="text-muted-foreground mb-2 text-xs">
    Set how long recipients have to sign after sending
  </p>
  <Select
    value={expirationPreset}
    onValueChange={(val: ExpirationPreset) => setExpirationPreset(val)}
  >
    <SelectTrigger>
      <SelectValue placeholder="No expiration" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="none">No expiration</SelectItem>
      <SelectItem value="7">7 days</SelectItem>
      <SelectItem value="14">14 days</SelectItem>
      <SelectItem value="30">30 days</SelectItem>
      <SelectItem value="60">60 days</SelectItem>
      <SelectItem value="90">90 days</SelectItem>
      <SelectItem value="custom">Custom...</SelectItem>
    </SelectContent>
  </Select>

  {expirationPreset === "custom" && (
    <div className="mt-2 flex gap-2">
      <Input
        type="number"
        min={1}
        max={365}
        value={customAmount}
        onChange={(e) => setCustomAmount(Number(e.target.value))}
        className="w-24"
      />
      <Select
        value={customUnit}
        onValueChange={(val: "day" | "week" | "month") => setCustomUnit(val)}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Days</SelectItem>
          <SelectItem value="week">Weeks</SelectItem>
          <SelectItem value="month">Months</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )}

  {getExpirationText() && (
    <p className="text-muted-foreground mt-1.5 text-xs">
      {getExpirationText()}
    </p>
  )}
</div>;
```

**Step 5: Update imports**

Remove: `CalendarIcon` from lucide imports (if unused elsewhere), `addDays`, `format` from date-fns (if unused elsewhere), `Calendar` component import, `Popover`, `PopoverContent`, `PopoverTrigger` imports (if unused elsewhere).

Add: `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `../ui/select`, `Input` from `../ui/input`.

**Step 6: Update the info box text**

Replace the deadline reference in the info box (line ~426-428) with expiration info:

```tsx
{
  getExpirationText() && (
    <span className="mt-1 block">{getExpirationText()}</span>
  );
}
```

**Step 7: Update the SendDocumentDialogProps interface**

Change `defaultDeadlineDays` to still accept it (for backward compatibility with org settings), but the internal state now converts it. No interface change needed.

**Step 8: Verify**

Run: `cd apps/web && bun --bun run typecheck`

**Step 9: Commit**

```bash
git add apps/web/src/components/documents/send-document-dialog.tsx
git commit -m "feat: replace calendar deadline picker with expiration dropdown presets"
```

---

### Task 10: Create document-expired email template + email function

**Files:**

- Create: `packages/transactional/src/emails/document-expired.tsx`
- Modify: `packages/transactional/src/index.ts` (export new template)
- Modify: `apps/backend/convex/documents/email.ts` (add sendDocumentExpiredNotification)

**Step 1: Create email template**

Create `packages/transactional/src/emails/document-expired.tsx` following the pattern of existing templates like `document-expiration-alert.tsx`:

```tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";

interface DocumentExpiredEmailProps {
  ownerName: string;
  documentName: string;
  expiredAt: string; // Formatted date string
}

export function DocumentExpiredEmail({
  ownerName,
  documentName,
  expiredAt,
}: DocumentExpiredEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your document "{documentName}" has expired</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Document Expired</Heading>
          <Text style={text}>Hi {ownerName},</Text>
          <Text style={text}>
            Your document <strong>{documentName}</strong> has expired as of{" "}
            {expiredAt}. All unsigned recipients have been marked as expired.
          </Text>
          <Text style={text}>
            You can re-send this document to give recipients a new expiration
            period.
          </Text>
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated message from Seal.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
};
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 48px",
  borderRadius: "5px",
};
const heading = {
  fontSize: "24px",
  fontWeight: "bold",
  marginBottom: "20px",
  color: "#1a1a1a",
};
const text = { fontSize: "16px", lineHeight: "26px", color: "#484848" };
const footer = {
  marginTop: "32px",
  paddingTop: "16px",
  borderTop: "1px solid #e6e6e6",
};
const footerText = { fontSize: "12px", color: "#999999" };

export async function renderDocumentExpired(props: DocumentExpiredEmailProps) {
  return render(<DocumentExpiredEmail {...props} />);
}
```

**Step 2: Export from index.ts**

Find the exports in `packages/transactional/src/index.ts` and add:

```typescript
export { renderDocumentExpired } from "./emails/document-expired";
```

**Step 3: Add sendDocumentExpiredNotification to email.ts**

In `apps/backend/convex/documents/email.ts`, add the import at the top:

```typescript
import { renderDocumentExpired } from "@seal/transactional";
```

Then add at the end of the file:

```typescript
export interface SendDocumentExpiredNotificationParams {
  to: string;
  ownerName: string;
  documentName: string;
  expiredAt: number;
}

export async function sendDocumentExpiredNotification(
  params: SendDocumentExpiredNotificationParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await renderDocumentExpired({
      ownerName: params.ownerName,
      documentName: params.documentName,
      expiredAt: new Date(params.expiredAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `Your document "${params.documentName}" has expired`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send document expired notification:", error);
    return { success: false, error: String(error) };
  }
}
```

**Step 4: Verify**

Run: `bun --bun run typecheck` (from root — checks all workspaces)

**Step 5: Commit**

```bash
git add packages/transactional/src/emails/document-expired.tsx packages/transactional/src/index.ts apps/backend/convex/documents/email.ts
git commit -m "feat: add document-expired email template and notification function"
```

---

### Task 11: Update workflow status badge + documents list filter

**Files:**

- Modify: `apps/web/src/components/documents/workflow-status-badge.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/documents/index.tsx`

**Step 1: Add "expired" to WorkflowStatusBadge (workflow-status-badge.tsx)**

Add `"expired"` to the `DocumentWorkflowStatus` type union (line 3–10):

```typescript
export type DocumentWorkflowStatus =
  | "draft"
  | "sent"
  | "in_progress"
  | "waiting_for_payment"
  | "completed"
  | "cancelled"
  | "declined"
  | "expired";
```

Add `expired` config to the `config` record (after `declined`, line ~57-60):

```typescript
    expired: {
      label: "Expired",
      variant: "destructive",
      className: "bg-orange-600 hover:bg-orange-600/90 text-white",
    },
```

**Step 2: Add "expired" to WorkflowStatusFilter (documents/index.tsx, line 95)**

```typescript
type WorkflowStatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "expired";
```

**Step 3: Add "Expired" filter button (after the Cancelled button, line ~1044-1050)**

```tsx
<Button
  size="sm"
  variant={workflowStatusFilter === "expired" ? "default" : "outline"}
  onClick={() => setWorkflowStatusFilter("expired")}
>
  Expired
</Button>
```

**Step 4: Verify**

Run: `cd apps/web && bun --bun run typecheck`

**Step 5: Commit**

```bash
git add apps/web/src/components/documents/workflow-status-badge.tsx apps/web/src/routes/_authenticated/\$slug/documents/index.tsx
git commit -m "feat: add expired status to workflow badge and documents list filter"
```

---

### Task 12: Add re-send flow for expired documents

**Files:**

- Modify: `apps/backend/convex/documents/send_document_action.ts` (update `resendRecipientEmail` to handle expired recipients)

**Step 1: Update resendRecipientEmail to handle expired status**

In the status check (line ~459-468), allow resending to expired recipients:

```typescript
// 4. Verify recipient hasn't completed their action (allow re-send for expired)
if (recipient.status === "signed" || recipient.status === "approved") {
  return {
    success: false,
    error: `Cannot resend - recipient has already ${recipient.status}`,
  };
}
```

Remove `recipient.status === "declined"` from the block — declined recipients shouldn't be re-sent either. Actually, keep declined blocked. Just remove the expired block:

The current code blocks signed, approved, and declined. It doesn't block expired (which doesn't exist yet). So once "expired" is a valid status, it will pass through. But we also need to reset the expiresAt.

**Step 2: Reset expiration on resend**

After verifying the recipient and before sending the email (line ~470), add:

```typescript
// 5a. If recipient is expired, reset their status and expiration
if (recipient.status === "expired") {
  const document_latest = await ctx.runQuery(
    internal.documents.queries.getDocumentInternal,
    {
      documentId: args.documentId,
    }
  );
  const expiresAt = document_latest?.expirationPeriod
    ? Date.now() +
      expirationPeriodToMs(
        document_latest.expirationPeriod.amount,
        document_latest.expirationPeriod.unit
      )
    : undefined;

  await ctx.runMutation(
    internal.documents.send_document_action.resetExpiredRecipient,
    {
      recipientId: args.recipientId,
      expiresAt,
    }
  );

  // If document is expired, transition back to sent
  if (document_latest?.workflowStatus === "expired") {
    await ctx.runMutation(
      internal.documents.send_document_action.reactivateExpiredDocument,
      {
        documentId: args.documentId,
      }
    );
  }
}
```

**Step 3: Create internal mutations for resetting expired state**

Add to `send_document_action.ts`:

```typescript
/**
 * Reset an expired recipient's status back to pending with new expiration.
 */
export const resetExpiredRecipient = internalMutation({
  args: {
    recipientId: v.id("document_recipients"),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.recipientId, {
      status: "pending",
      expiresAt: args.expiresAt,
      expirationNotifiedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Transition an expired document back to "sent" status for re-sending.
 */
export const reactivateExpiredDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.workflowStatus !== "expired") return;

    await ctx.db.patch(args.documentId, {
      workflowStatus: "sent",
      sentAt: Date.now(),
      expiredAt: undefined,
      updatedAt: Date.now(),
    });
  },
});
```

**Step 4: Verify**

Run: `cd apps/backend && bun --bun run typecheck`

**Step 5: Commit**

```bash
git add apps/backend/convex/documents/send_document_action.ts
git commit -m "feat: add re-send flow for expired documents and recipients"
```

---

### Task 13: Write expiration sweep tests

**Files:**

- Create: `apps/backend/convex/documents/__tests__/expiration_sweep.test.ts`

**Step 1: Write tests**

```typescript
import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("sweepExpiredRecipients", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;
  let documentId: Id<"documents">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Test Owner",
        clerkId: "clerk_test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        workflowStatus: "sent",
        sentAt: Date.now() - 86_400_000 * 8, // Sent 8 days ago
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expirationPeriod: { amount: 7, unit: "day" },
      });
    });
  });

  test("expires pending recipients past their expiresAt", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "signer@test.com",
        name: "Test Signer",
        role: "signer",
        signingOrder: 0,
        authenticationMethod: "email",
        accessToken: "token-123",
        status: "pending",
        expiresAt: Date.now() - 1000, // Expired 1 second ago
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Import and run the sweep
    const { sweepExpiredRecipients } = await import("../expiration_sweep");
    await t.run(async (ctx) => {
      await sweepExpiredRecipients(ctx, {});
    });

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient!.status).toBe("expired");
    expect(recipient!.expirationNotifiedAt).toBeTypeOf("number");
  });

  test("does NOT expire recipients whose expiresAt is in the future", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "signer@test.com",
        name: "Test Signer",
        role: "signer",
        signingOrder: 0,
        authenticationMethod: "email",
        accessToken: "token-456",
        status: "pending",
        expiresAt: Date.now() + 86_400_000, // Expires tomorrow
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const { sweepExpiredRecipients } = await import("../expiration_sweep");
    await t.run(async (ctx) => {
      await sweepExpiredRecipients(ctx, {});
    });

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient!.status).toBe("pending");
  });

  test("transitions document to expired when all recipients are expired", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("document_recipients", {
        documentId,
        email: "signer@test.com",
        name: "Test Signer",
        role: "signer",
        signingOrder: 0,
        authenticationMethod: "email",
        accessToken: "token-789",
        status: "pending",
        expiresAt: Date.now() - 1000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const { sweepExpiredRecipients } = await import("../expiration_sweep");
    await t.run(async (ctx) => {
      await sweepExpiredRecipients(ctx, {});
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc!.workflowStatus).toBe("expired");
    expect(doc!.expiredAt).toBeTypeOf("number");
  });

  test("does NOT transition document when some recipients are still pending (not expired)", async () => {
    await t.run(async (ctx) => {
      // One expired recipient
      await ctx.db.insert("document_recipients", {
        documentId,
        email: "expired@test.com",
        name: "Expired Signer",
        role: "signer",
        signingOrder: 0,
        authenticationMethod: "email",
        accessToken: "token-expired",
        status: "pending",
        expiresAt: Date.now() - 1000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // One still-active recipient
      await ctx.db.insert("document_recipients", {
        documentId,
        email: "active@test.com",
        name: "Active Signer",
        role: "signer",
        signingOrder: 0,
        authenticationMethod: "email",
        accessToken: "token-active",
        status: "pending",
        expiresAt: Date.now() + 86_400_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const { sweepExpiredRecipients } = await import("../expiration_sweep");
    await t.run(async (ctx) => {
      await sweepExpiredRecipients(ctx, {});
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    // Document should still be "sent" because one recipient is still active
    expect(doc!.workflowStatus).toBe("sent");
  });

  test("expires viewed recipients too (not just pending)", async () => {
    const recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "viewer@test.com",
        name: "Test Viewer",
        role: "signer",
        signingOrder: 0,
        authenticationMethod: "email",
        accessToken: "token-viewed",
        status: "viewed",
        expiresAt: Date.now() - 1000,
        accessedAt: Date.now() - 86_400_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const { sweepExpiredRecipients } = await import("../expiration_sweep");
    await t.run(async (ctx) => {
      await sweepExpiredRecipients(ctx, {});
    });

    const recipient = await t.run(async (ctx) => {
      return await ctx.db.get(recipientId);
    });

    expect(recipient!.status).toBe("expired");
  });

  test("idempotent — already-notified recipients are not processed again", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("document_recipients", {
        documentId,
        email: "already@test.com",
        name: "Already Expired",
        role: "signer",
        signingOrder: 0,
        authenticationMethod: "email",
        accessToken: "token-already",
        status: "pending",
        expiresAt: Date.now() - 1000,
        expirationNotifiedAt: Date.now() - 500, // Already processed
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const { sweepExpiredRecipients } = await import("../expiration_sweep");
    await t.run(async (ctx) => {
      await sweepExpiredRecipients(ctx, {});
    });

    // Should not crash or re-process — idempotent
    // The recipient was already processed (has expirationNotifiedAt)
    // so the sweep should skip it
  });
});
```

**Note:** The sweep function is an `internalMutation` that can be called directly from `t.run()` by importing the handler. However, the `sweepExpiredRecipients` is registered as an internal mutation with convex — to test it with `t.run`, we need to call the handler function directly. The exact import pattern may need adjustment based on how `convex-test` handles internal mutations. If direct import doesn't work, use `t.mutation(internal.documents.expiration_sweep.sweepExpiredRecipients, {})`.

**Step 2: Run tests**

Run: `cd apps/backend && bun --bun vitest run convex/documents/__tests__/expiration_sweep.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add apps/backend/convex/documents/__tests__/expiration_sweep.test.ts
git commit -m "test: add expiration sweep cron tests"
```

---

### Task 14: Fix type errors + regenerate Convex types + full verification

**Files:**

- Various files that may have type errors from the new "expired" status
- `apps/backend/convex/_generated/` (regenerated)

**Step 1: Run full typecheck**

Run: `bun --bun run typecheck`
Expected: Identify and fix any remaining type errors caused by the expanded status unions.

Common fixes needed:

- Any exhaustive switch/case on `RecipientStatus` or `DocumentWorkflowStatus` needs `"expired"` case
- The `resendRecipientEmail` status check in `send_document_action.ts` (already handled in Task 12)
- Any frontend component that uses a narrower type union for recipient status

**Step 2: Fix each error**

Address each type error individually. Common patterns:

- Add `case "expired":` to switch statements
- Add `|| status === "expired"` to conditional checks
- Update type unions in frontend components

**Step 3: Regenerate Convex types**

The Convex dev server auto-regenerates `_generated/` when schemas change. If not running:

Run: `cd apps/backend && bun --bun run dev` (briefly to regenerate, then stop)

**Step 4: Run build**

Run: `bun --bun run build`
Expected: All workspaces build successfully.

**Step 5: Run all tests**

Run: `cd apps/backend && bun --bun vitest run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "fix: resolve type errors and regenerate Convex types for document expiration"
```

---

### Task 15: Update feature execution plan

**Files:**

- Modify: `docs/plans/2026-02-25-feature-execution-plan.md`

**Step 1: Update Feature #3 status to DONE**

Find Feature #3 in the plan and update its status from the current state to `DONE`.

**Step 2: Commit**

```bash
git add docs/plans/2026-02-25-feature-execution-plan.md
git commit -m "docs: mark Feature #3 Document Expiration as DONE"
```
