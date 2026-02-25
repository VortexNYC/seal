# Signing Order Enforcement — Design Document

## Goal

Enforce the recipient signing order that already exists in the schema but is currently ignored. When a sender sets recipients to sign in a specific order, earlier recipients must complete their action before later recipients can access the document. This is a prerequisite for compliance-grade sequential signing (e.g., "employee signs first, then manager countersigns").

## Current State

- `document_recipients` has an `order` field: `v.optional(v.number())` with comment "For sequential signing workflows"
- `by_document_order` index exists: `["documentId", "order"]`
- Recipients are sorted by `order` in queries
- **Zero enforcement** — all recipients get emails simultaneously, anyone can sign at any time regardless of order
- Documents have no `signingMode` field (all documents behave as parallel)
- The `submitRecipientSignature` mutation has no order-based gating

## Relationship to Approval Workflows

This feature and the Approval Workflows feature share the same underlying mechanism (`signingMode: "sequential"` + order-based gating). This document focuses on the **core enforcement engine**. The Approval Workflows document adds the **approver-specific UX** (approve button, no signature capture, request changes).

**Implementation order:** Build Signing Order Enforcement first, then layer Approval Workflows on top. The enforcement engine is the foundation.

## Design

### Sequential Signing Mode

Add to the `documents` schema:

```typescript
signingMode: v.optional(v.union(
  v.literal("parallel"),     // Default — everyone at once
  v.literal("sequential"),   // Enforce order groups
)),
```

When `signingMode === "sequential"`:

1. Only the first incomplete order group receives invitation emails on send
2. Recipients cannot access the signing page until their group is active
3. When all recipients in a group complete, the next group is automatically notified
4. Within the same order group, recipients are parallel (can sign in any order)

### Order Groups

Recipients with the same `order` value form a group. Groups are processed in ascending order:

```
Order 0: Alice (signer), Bob (approver)     ← Active immediately
Order 1: Carol (signer)                     ← Active after Order 0 completes
Order 2: Dave (viewer), Eve (signer)        ← Active after Order 1 completes
```

- `order: 0` (or `undefined`/`null`) = first group
- A group is "complete" when every recipient in it has a terminal status (`signed`, `approved`, `viewed`, or `declined`)
- If any recipient in a group declines, the document transitions to `declined` status — subsequent groups are never notified

### Backend Enforcement Points

#### 1. Send Document (`sendDocumentEmails`)

```typescript
// Current: sends to all recipients
// New: if sequential, send only to first incomplete group

if (document.signingMode === "sequential") {
  const recipients = await getRecipientsByDocumentOrdered(ctx, document._id);
  const firstIncompleteGroup = findFirstIncompleteGroup(recipients);
  await sendEmailsToGroup(ctx, document, firstIncompleteGroup);
} else {
  // Parallel: current behavior, send to all
  await sendEmailsToAll(ctx, document, recipients);
}
```

#### 2. Signing Page Access (`getRecipientByToken`)

Add a check after token validation:

```typescript
// After finding recipient by token, check if their group is active
if (document.signingMode === "sequential") {
  const myOrder = recipient.order ?? 0;
  const allRecipients = await ctx.db
    .query("document_recipients")
    .withIndex("by_document_order", q => q.eq("documentId", document._id))
    .collect();

  const previousGroupsComplete = allRecipients
    .filter(r => (r.order ?? 0) < myOrder)
    .every(r => isRecipientTerminal(r.status));

  if (!previousGroupsComplete) {
    // Return a "not your turn yet" state instead of the document
    return {
      ...recipientData,
      waitingForPreviousGroup: true,
      currentGroupOrder: getCurrentActiveGroup(allRecipients),
    };
  }
}
```

The signing page renders a **"waiting" state** instead of the document when `waitingForPreviousGroup` is true:
- "This document requires other recipients to complete their action first."
- "You'll receive an email when it's your turn."
- No document content shown — prevents premature access

#### 3. Submit Signature (`submitRecipientSignature`)

Hard gate — the last line of defense:

```typescript
if (document.signingMode === "sequential") {
  const myOrder = recipient.order ?? 0;
  const previousRecipients = await ctx.db
    .query("document_recipients")
    .withIndex("by_document_order", q => q.eq("documentId", document._id))
    .collect()
    .then(rs => rs.filter(r => (r.order ?? 0) < myOrder));

  if (!previousRecipients.every(r => isRecipientTerminal(r.status))) {
    throw new ConvexError("Previous recipients must complete their action first");
  }
}
```

#### 4. Next Group Notification (after completion)

After `submitRecipientSignature` updates recipient status:

```typescript
// Check if this completion activates the next group
if (document.signingMode === "sequential") {
  const allRecipients = await getRecipientsByDocumentOrdered(ctx, document._id);
  const myOrder = recipient.order ?? 0;
  const myGroup = allRecipients.filter(r => (r.order ?? 0) === myOrder);

  // Is my entire group now complete?
  if (myGroup.every(r => isRecipientTerminal(r.status))) {
    const nextGroup = allRecipients
      .filter(r => (r.order ?? 0) === myOrder + 1 && r.status === "pending");

    if (nextGroup.length > 0) {
      // Notify next group
      await ctx.scheduler.runAfter(0, internal.documents.email.sendGroupNotification, {
        documentId: document._id,
        recipientIds: nextGroup.map(r => r._id),
      });
    }
  }
}
```

### Helper Functions

Add to `recipient_helpers.ts`:

```typescript
// Get recipients grouped and sorted by order
function groupRecipientsByOrder(recipients: Doc<"document_recipients">[]) {
  const groups = new Map<number, Doc<"document_recipients">[]>();
  for (const r of recipients) {
    const order = r.order ?? 0;
    if (!groups.has(order)) groups.set(order, []);
    groups.get(order)!.push(r);
  }
  return new Map([...groups].sort(([a], [b]) => a - b));
}

// Find the first group where not all recipients are terminal
function findFirstIncompleteGroup(recipients: Doc<"document_recipients">[]) {
  const groups = groupRecipientsByOrder(recipients);
  for (const [order, group] of groups) {
    if (!group.every(r => isRecipientTerminal(r.status))) {
      return group;
    }
  }
  return [];
}

// Check if a specific recipient's group is active
function isGroupActive(recipient: Doc<"document_recipients">, allRecipients: Doc<"document_recipients">[]) {
  const myOrder = recipient.order ?? 0;
  return allRecipients
    .filter(r => (r.order ?? 0) < myOrder)
    .every(r => isRecipientTerminal(r.status));
}
```

### Sender UI

#### Recipient Order Configuration

In the document editor's recipient panel:

- **Parallel mode** (default): Recipients listed in a flat list, no order numbers shown
- **Sequential mode**: Recipients shown in numbered groups with drag-to-reorder
  - Each group shows an order number (1, 2, 3...)
  - Recipients within a group are listed side-by-side or stacked
  - "Add group" button creates a new order level
  - Drag a recipient between groups to change their order
  - Visual: `Step 1 → Step 2 → Step 3` pipeline

Toggle between modes with a switch: "Send to all at once" / "Send in order"

#### Document Detail Page (in-progress view)

When viewing a sequential document that's been sent:

- **Workflow progress bar**: Shows which group is currently active
- **Group cards**: Each group shows its recipients with status badges
  - Completed groups: collapsed, green checkmark
  - Active group: expanded, highlighted
  - Pending groups: collapsed, grayed out, "Waiting" label
- **Timeline**: When each group was activated and completed

### Signing Page "Waiting" State

When a recipient accesses a sequential document before their group is active:

```
┌─────────────────────────────────────────┐
│  📄 Employment Agreement                │
│                                         │
│  This document requires other           │
│  recipients to complete their           │
│  action first.                          │
│                                         │
│  Current step: 1 of 3                   │
│  ● Step 1: Legal Review (in progress)   │
│  ○ Step 2: Your signature (waiting)     │
│  ○ Step 3: Countersign                  │
│                                         │
│  You'll receive an email when it's      │
│  your turn to sign.                     │
└─────────────────────────────────────────┘
```

No document content is shown — the recipient only sees progress information. The document header (name) is visible but PDF content is not loaded.

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Recipient in group N declines | Document status → `declined`. Groups N+1, N+2, etc. are never notified. Sender can cancel or void. |
| Sender cancels mid-workflow | All pending groups receive cancellation email. Document status → `cancelled`. |
| Sender adds recipient to active group | New recipient immediately receives invitation email. |
| Sender removes recipient from completed group | If group was the gate for the next group, re-evaluate. If still complete, no change. |
| Recipient's token expires while waiting | They receive a fresh email when their group activates with a new token. |
| Single recipient per group | Functions identically — group of 1 completes when that 1 recipient is terminal. |
| All recipients in order 0 | Behaves like parallel mode — everyone gets emails at once. |

### What We Skip (v1)

- **Conditional branching** — "if group 1 approves, go to group 2; if they decline, go to group 3" — sequential only, no branching
- **Group deadlines** — "group 1 has 3 days, then auto-escalate" — use document-level deadline only
- **Partial group completion triggers** — "notify group 2 when 2 of 3 in group 1 complete" — unanimous completion only
- **Reassignment** — "if Alice doesn't sign in group 1, reassign to Bob" — manual intervention by sender
- **Undo group completion** — once a group is complete and next is notified, no rollback

### Permissions

No new permissions. Sequential mode is configured by whoever has `documents:edit`.

### Plan Gating

| Feature | Free | Pro |
|---------|------|-----|
| Sequential signing (2 groups) | Yes | Yes |
| Sequential signing (3+ groups) | No | Yes |
| Workflow progress visualization | No | Yes |

Free plan supports basic two-step sequential (e.g., signer then countersigner). Pro plan supports unlimited groups with the visual workflow builder.

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/backend/convex/schemas/documents.ts` | Modify — add `signingMode` field |
| `apps/backend/convex/documents/send_document_action.ts` | Modify — sequential email dispatch |
| `apps/backend/convex/documents/recipients_mutations.ts` | Modify — order enforcement gate in `submitRecipientSignature` |
| `apps/backend/convex/documents/recipients_queries.ts` | Modify — `getRecipientByToken` returns waiting state |
| `apps/backend/convex/documents/recipient_helpers.ts` | Modify — add group helper functions |
| `apps/backend/convex/documents/email.ts` | Modify — `sendGroupNotification` for next-group activation |
| `apps/web/src/routes/sign.$token.tsx` | Modify — render "waiting" state when group not active |
| `apps/web/src/components/documents/add-recipient-dialog.tsx` | Modify — sequential mode UI, order group assignment |
| `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx` | Modify — workflow progress visualization |
| `packages/transactional/` | Modify — "your turn" notification email template |
