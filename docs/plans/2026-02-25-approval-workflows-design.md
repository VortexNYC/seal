# Approval Workflows — Design Document

> **Status:** IMPLEMENTED — Schema (`approver` role, `approved` status, `approvedAt`), backend helpers (`isRecipientComplete`), and frontend (add-recipient dialog, signing page, send dialog) all merged to staging.

## Goal

Enable multi-step document workflows where approvers must review and approve a document before signers are asked to sign. This closes a critical gap for enterprise use cases: legal review before signing, manager approval of contracts, compliance sign-off before execution.

## Current State

The data model is surprisingly approval-aware already:

**What exists:**
- `approver` is a first-class recipient role (`signer | viewer | approver`)
- `approved` is a valid recipient status with `approvedAt` timestamp
- `submitRecipientSignature` enforces role-status consistency (only approvers can have `approved` status)
- `checkAndCompleteWorkflow` treats `approved` as a terminal state for approvers
- `recipient.approved` webhook event type exists
- Certificate of completion already includes `approvedAt`
- `order` field exists on `document_recipients` with `by_document_order` index

**What's missing:**
- **No enforcement** — signers can sign before approvers approve; all recipients get emails simultaneously
- **No distinct approval UX** — approvers go through the same signature capture UI as signers
- **No sequential email dispatch** — everyone is notified at once regardless of `order` field
- **No approval-specific UI** — no "Approve" / "Request Changes" buttons (just Sign / Decline)

## Design

### Workflow Model

Documents support two workflow modes, configured at send time:

| Mode | Behavior |
|------|----------|
| **Parallel** (default) | All recipients receive emails at once. No ordering enforcement. Current behavior. |
| **Sequential** | Recipients are grouped by `order` value. Group N+1 is only notified after all recipients in group N have completed their action (signed/approved/viewed). |

The `order` field already exists. We add enforcement logic, not new schema.

### How Sequential Mode Works

**Example: Legal approval → Manager approval → Signer execution**

```
Order 0: Legal Team (approver)     ← Gets email immediately on send
Order 1: VP of Sales (approver)    ← Gets email only after Legal approves
Order 2: Client (signer)           ← Gets email only after VP approves
Order 2: Witness (viewer)          ← Also gets email at order 2 (parallel within group)
```

- Recipients with the same `order` value are parallel within their group
- `order: 0` group is notified first
- When all recipients in a group reach a terminal state, the next group is notified
- `viewer` recipients complete by viewing (existing `isRecipientComplete` logic)

### Approval UX (Signing Page)

When a recipient with `role: "approver"` opens the signing page:

1. **Document renders normally** — they can read and review the full document
2. **Action buttons change** — instead of "Sign Document" / "Decline", they see:
   - **"Approve"** (primary) — marks the document as approved
   - **"Request Changes"** (secondary) — opens a dialog for feedback (maps to `declined` status with reason)
3. **No signature capture** — approvers don't need to draw/type a signature. The "Approve" action records `approvedAt` timestamp and their identity
4. **Optional comment** — approvers can add a note on approval (stored in audit log)

The signing page already checks `recipient.role` in `submitRecipientSignature`. We add UI branching based on role.

### Sequential Enforcement

#### Sending (`sendDocumentEmails`)

Modify to respect sequential mode:

```
if (document.signingMode === "sequential") {
  // Only send to the first incomplete group
  const groups = groupBy(recipients, r => r.order ?? 0);
  const sortedOrders = Object.keys(groups).sort((a, b) => a - b);

  for (const order of sortedOrders) {
    const group = groups[order];
    const allComplete = group.every(r => isRecipientTerminal(r.status));
    if (!allComplete) {
      // Send only to pending recipients in this group
      sendEmailsTo(group.filter(r => r.status === "pending"));
      break;
    }
  }
} else {
  // Parallel: send to everyone (current behavior)
  sendEmailsTo(recipients.filter(r => !isRecipientTerminal(r.status)));
}
```

#### Signing Gate (`submitRecipientSignature`)

Add an order check before allowing any action:

```
if (document.signingMode === "sequential") {
  const allRecipients = await db.query("document_recipients")
    .withIndex("by_document_order", q => q.eq("documentId", document._id))
    .collect();

  const myOrder = recipient.order ?? 0;
  const previousGroups = allRecipients.filter(r => (r.order ?? 0) < myOrder);
  const allPreviousComplete = previousGroups.every(r => isRecipientTerminal(r.status));

  if (!allPreviousComplete) {
    throw new ConvexError("Previous recipients must complete their action first");
  }
}
```

#### Next Group Notification

After a recipient completes their action (`submitRecipientSignature` → `checkAndCompleteWorkflow`):

```
// After updating recipient status, check if we should notify next group
if (document.signingMode === "sequential") {
  const allRecipients = await getRecipients(document._id);
  const completedOrders = getFullyCompletedOrders(allRecipients);
  const nextPendingGroup = getNextPendingGroup(allRecipients, completedOrders);

  if (nextPendingGroup.length > 0) {
    // Schedule emails to next group
    await ctx.scheduler.runAfter(0, internal.documents.email.sendGroupNotification, {
      documentId: document._id,
      recipientIds: nextPendingGroup.map(r => r._id),
    });
  }
}
```

### Schema Changes

#### Modify: `documents`

```typescript
// Add to document schema
signingMode: v.optional(v.union(
  v.literal("parallel"),     // Default — current behavior
  v.literal("sequential"),   // Enforce order groups
)),
```

No other schema changes needed — `order` and `approver` role already exist.

### Sender UI Changes

#### Add Recipient Dialog / Document Recipients Panel

1. **Signing mode toggle**: "Parallel" / "Sequential" switch. When sequential is selected:
   - Recipients are grouped visually by order number
   - Drag-to-reorder between groups
   - "Add group" button creates a new order level
   - Visual pipeline: `Group 1 → Group 2 → Group 3`

2. **Role selector** per recipient: Dropdown with `Signer` / `Approver` / `Viewer` (already partially exists as a field in the add recipient UI)

3. **Order assignment**: In sequential mode, each recipient gets assigned to a group (order number). In parallel mode, order is hidden/irrelevant.

#### Document Detail Page

When a sequential document is in progress:
- Show a **workflow progress indicator**: pipeline showing which group is active
- Each group shows its recipients with status badges
- Completed groups are collapsed, active group is expanded

### Audit Trail

New audit events:
- `recipient.approval_requested` — notification sent to approver
- `recipient.approved` — approver approved (already exists in webhook events)
- `recipient.changes_requested` — approver requested changes (maps to declined)
- `document.group_completed` — all recipients in an order group completed
- `document.next_group_notified` — next group received their notifications

### Email Templates

New email for sequential workflows:
- **"It's your turn"** email — sent when a previous group completes and it's now this recipient's turn. Different from the initial invitation email. Subject: `"{Document Name}" is ready for your {review/signature}`

Modify existing invitation email:
- For approvers: "You've been asked to **review and approve** this document" (instead of "sign")
- CTA button: "Review Document" (instead of "Sign Document")

### What We Skip (v1)

- **Conditional routing** — "if approver declines, route to alternate approver" — too complex for v1
- **Parallel approval with threshold** — "2 of 3 approvers must approve" — use unanimous approval for now
- **Approval delegation** — "approver assigns someone else to approve on their behalf"
- **Approval expiry** — "auto-escalate if not approved in X days"
- **Comment threads** — approvers can only leave a single reason when requesting changes, not have a conversation
- **Partial approval** — approvers approve or decline the whole document, not individual sections

### Permissions

No new permissions — controlled by existing `documents:edit` for configuring workflows and recipient roles.

### Plan Gating

| Feature | Free | Pro |
|---------|------|-----|
| Approver role | Yes | Yes |
| Sequential mode | No | Yes |
| Approval workflow progress UI | No | Yes |

Free plan gets the approver role (parallel only — approve and sign happen simultaneously). Pro plan gets sequential enforcement (approval gates signing).

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/backend/convex/schemas/documents.ts` | Modify — add `signingMode` field |
| `apps/backend/convex/documents/send_document_action.ts` | Modify — sequential email dispatch |
| `apps/backend/convex/documents/recipients_mutations.ts` | Modify — signing order enforcement gate |
| `apps/backend/convex/documents/recipient_helpers.ts` | Modify — add `getNextPendingGroup`, `getFullyCompletedOrders` helpers |
| `apps/backend/convex/documents/email.ts` | Modify — "it's your turn" email trigger, approver-specific email wording |
| `apps/web/src/routes/sign.$token.tsx` | Modify — approver-specific UI (Approve/Request Changes buttons, no signature capture) |
| `apps/web/src/components/documents/add-recipient-dialog.tsx` | Modify — role selector, order group assignment |
| `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx` | Modify — workflow progress indicator |
| `packages/transactional/` | Modify — approver invitation email template, "your turn" notification template |
| `apps/backend/convex/schemas/audit_logs.ts` | Modify — add new event types |
