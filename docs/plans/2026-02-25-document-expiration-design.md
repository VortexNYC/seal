# Document Expiration — Design Document

> **Status:** IN PROGRESS
> **Updated:** 2026-02-26 (validated against codebase, removed plan gating)

## Goal

Allow senders to set an expiration period on documents so that unsigned documents automatically expire after a configurable duration. When a document expires, recipients can no longer access the signing page, the sender is notified, and the document transitions to an "expired" workflow status. This reduces stale documents cluttering the workspace and provides urgency for recipients to sign.

## Current State (as of 2026-02-26)

**Already exists:**
- `documents.deadline` field (optional timestamp) — informational only, no enforcement
- `documents.expirationAlertsSent` array — tracks which day-counts have been alerted
- `expiration_alerts.ts` — cron that sends owner alert emails when docs approach deadline (daily at 10am UTC)
- `automated_reminders.ts` — cron that sends recipient reminders based on org `reminderSchedule` (daily at 9am UTC)
- `send-document-dialog.tsx` — has calendar-based deadline picker with `defaultDeadlineDays` from org settings
- Org settings: `defaultDeadlineDays`, `expirationAlertDays`, `reminderSchedule`

**Does NOT exist (what this feature adds):**
- No automated enforcement — recipients can sign past deadline
- No `"expired"` workflow status
- No `"expired"` recipient status
- No per-recipient `expiresAt` timestamp
- No sweep cron to expire recipients
- No signing page gate blocking expired access
- No re-send flow for expired documents
- No `DocumentExpiredPage` component
- No "Expired" filter in documents list

## Design

### User Flow

1. When sending a document, sender selects expiration from a dropdown in the send dialog:
   - `None` (no expiration — default)
   - `7 days`
   - `14 days`
   - `30 days`
   - `60 days`
   - `90 days`
   - `Custom` (shows unit + amount inputs: number field + day/week/month selector)
2. This replaces the existing raw calendar-based deadline picker
3. When the document is sent, each recipient's `expiresAt` timestamp is computed as `sentAt + expirationPeriod`
4. The `deadline` field continues to be set (for the existing alert cron to function)
5. If a recipient accesses the signing page after their `expiresAt`, they see a full-screen message: "This document has expired. Please contact the sender for a new copy."
6. A cron job runs every 15 minutes to sweep expired recipients and transition document status
7. When all pending recipients have expired (none signed), the document workflow status transitions to `expired`
8. The sender receives an email notification when a document expires
9. Sender can "re-send" an expired document, which resets expiration and generates new tokens

### Schema Changes

#### Modify: `documents` (in `apps/backend/convex/schemas/documents.ts`)

```typescript
// New field (the existing `deadline` timestamp stays as-is for alert cron compatibility)
expirationPeriod: v.optional(v.object({
  amount: v.number(),                                    // e.g., 30
  unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
})),
```

#### Modify: `document_recipients` (in `apps/backend/convex/schemas/recipients.ts`)

```typescript
// Add "expired" to recipientStatusTuple
v.literal("expired"),

// New fields on recipientsTable
expiresAt: v.optional(v.number()),            // Timestamp when this recipient's access expires
expirationNotifiedAt: v.optional(v.number()), // When expiration notification was sent (idempotency)
```

#### Modify: `document_workflow_status.ts`

```typescript
// Add to the union
v.literal("expired"),

// Add to WORKFLOW_TRANSITIONS
sent: ["in_progress", "cancelled", "declined", "expired"],
in_progress: ["completed", "waiting_for_payment", "cancelled", "declined", "expired"],

// "expired" is a terminal state
expired: [],

// Update getWorkflowStatusLabel
expired: "Expired",

// Update isTerminalWorkflowStatus
return status === "completed" || status === "cancelled" || status === "declined" || status === "expired";
```

#### Modify: `audit_logs.ts`

```typescript
// Add new action types to auditActionTuple
v.literal("document.expired"),
v.literal("recipient.expired"),
```

### Backend Implementation

#### Expiration Computation (in send flow)

The `sendDocumentEmailsInternal` action (in `send_document_action.ts`) is called after `sendDocument` mutation transitions to "sent". This action should:
1. Read the document's `expirationPeriod`
2. Compute `expiresAt = sentAt + convertToMs(amount, unit)`
3. Patch each recipient with `expiresAt`
4. Also set `document.deadline = expiresAt` (for existing alert cron compatibility)

Conversion: `day` = 86400000ms, `week` = 604800000ms, `month` = 2592000000ms (30 days).

#### Expiration Sweep Cron (new)

Create `apps/backend/convex/documents/expiration_sweep.ts`:
- Register in `crons.ts`: every 15 minutes, call `internal.documents.expiration_sweep.sweepExpiredRecipients`
- Query: all `document_recipients` where `expiresAt < Date.now()` AND `status === "pending"` AND `expirationNotifiedAt IS NULL`
- Process up to 100 recipients per run (Convex mutation time budget)
- For each expired recipient:
  1. Set recipient status to `"expired"` (NOT `"declined"` — distinct semantics)
  2. Set `expirationNotifiedAt = Date.now()` (idempotency)
  3. Log `recipient.expired` audit event
- After processing recipients, check each affected document:
  - If ALL recipients are in terminal states (signed, expired, declined) AND at least one is expired → transition document to `expired`
  - If some recipients signed but remaining expired → still `expired` (partial completion)
- Schedule sender notification email for each newly expired document

> **Note**: Also process `status === "viewed"` recipients — they accessed but didn't sign, so they should expire too.

#### Signing Page Gate

In `sign.$token.tsx`, after resolving the recipient (before rendering signing flow):

```typescript
if (recipient.expiresAt && recipient.expiresAt < Date.now()) {
  return <DocumentExpiredPage senderName={document.ownerName} />
}
```

This provides instant feedback even between cron sweeps.

#### Re-send Expired Document

Extend existing resend functionality:
- Reset `expiresAt` on all pending/expired recipients (recompute from now + expirationPeriod)
- Clear `expirationNotifiedAt`
- If document is `"expired"`, transition back to `"sent"` (add `expired → sent` to WORKFLOW_TRANSITIONS)
- Regenerate signing tokens for expired recipients

### Frontend

#### Send Document Dialog (`send-document-dialog.tsx`)

Replace the raw calendar deadline picker with a preset dropdown:
- Options: None / 7 days / 14 days / 30 days / 60 days / 90 days / Custom
- Custom: number input (1-365) + unit selector (days/weeks/months)
- Helper text: "Recipients will have X days to sign after the document is sent"
- Store as `expirationPeriod` on the document (and compute `deadline` timestamp on send)
- All users get all options (no plan gating)

#### Document Expired Page (`document-expired-page.tsx`)

New component — full-screen message for expired signing links:
- Seal logo
- "This document has expired"
- "The sender set an expiration date that has passed. Please contact them for a new signing link."
- Sender's name (but not email, for privacy)

#### Document Detail Page

- Show expiration status in document header: "Expires in 14 days" or "Expired on Feb 25, 2026"
- Per-recipient row: show "Expires Feb 25" badge or "Expired" badge in red
- Action button: "Re-send" on expired documents (re-computes expiresAt from now)

#### Documents List

- Add "Expired" to workflow status filter chips
- Expired documents show with distinct visual treatment (muted row, clock icon)

### Permissions

No new permissions needed. Expiration is configured by whoever has `documents:edit` permission. The cron job runs as a system actor.

### What We Skip (v1)

- No per-recipient expiration overrides (all recipients share the document's expiration period)
- No "expiring soon" reminder emails (the existing alert cron already handles this)
- No automatic re-send on expiration (sender must manually re-send)
- No expiration for documents already in `in_progress` status (at least one signer has signed) — **actually we DO expire in_progress documents** per the design, since partial signatures + expired remaining recipients = expired
- No timezone-aware expiration (all UTC)
- No plan gating — all users get all expiration features

### Signing Page Interaction Order

When multiple features modify the signing page (`sign.$token.tsx`), they must be evaluated in this order:

1. **Expiration gate** (this feature) — if expired, block immediately, show expired message
2. **Authentication gate** (future) — if SMS/ID required, verify before showing document
3. **Normal signing flow** — render document and fields
4. **Dictation dialog** (future) — after signing, if next recipient is placeholder
5. **Redirect** (future) — after signing (and after dictation if applicable), redirect to URL

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/backend/convex/schemas/documents.ts` | Modify — add `expirationPeriod` field |
| `apps/backend/convex/schemas/recipients.ts` | Modify — add `expiresAt`, `expirationNotifiedAt` fields, add `"expired"` to `recipientStatusTuple` |
| `apps/backend/convex/schemas/document_workflow_status.ts` | Modify — add `"expired"` literal, update `WORKFLOW_TRANSITIONS`, labels, terminal check |
| `apps/backend/convex/schemas/audit_logs.ts` | Modify — add `document.expired`, `recipient.expired` actions |
| `apps/backend/convex/documents/expiration_sweep.ts` | Create — sweep mutation + cron handler |
| `apps/backend/convex/crons.ts` | Modify — register 15-minute sweep cron |
| `apps/backend/convex/documents/send_document_action.ts` | Modify — compute `expiresAt` per recipient in send flow |
| `apps/backend/convex/documents/workflow_helpers.ts` | Modify — update `isTerminalWorkflowStatus` to include `"expired"` |
| `apps/web/src/routes/sign.$token.tsx` | Modify — add expiration gate before signing flow |
| `apps/web/src/components/signing/document-expired-page.tsx` | Create — expired message page |
| `apps/web/src/components/documents/send-document-dialog.tsx` | Modify — replace calendar with preset dropdown |
| `packages/transactional/emails/document-expired.tsx` | Create — sender notification email |
