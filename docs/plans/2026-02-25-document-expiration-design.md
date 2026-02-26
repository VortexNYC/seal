# Document Expiration — Design Document

> **Status:** NOT STARTED

## Goal

Allow senders to set an expiration period on documents so that unsigned documents automatically expire after a configurable duration. When a document expires, recipients can no longer access the signing page, the sender is notified, and the document transitions to an "expired" workflow status. This reduces stale documents cluttering the workspace and provides urgency for recipients to sign.

## Current State

- Documents have a `deadline` field (optional timestamp) but no automated enforcement — it is informational only
- No concept of per-recipient expiration
- No cron job to sweep expired documents
- No "expired" workflow status — the existing statuses are: `draft`, `sent`, `in_progress`, `completed`, `cancelled`, `declined`
- Recipients can access signing pages indefinitely as long as the token has not expired (30-day token expiry is independent of document expiration)

## Design

### User Flow

1. When preparing a document (draft state), sender opens **Document Settings** panel
2. Under a new **"Expiration"** section, sender selects from a dropdown:
   - `None` (no expiration)
   - `7 days`
   - `14 days`
   - `30 days`
   - `60 days`
   - `90 days`
   - `Custom` (shows unit + amount inputs: number field + day/week/month selector)
3. When the document is sent, each recipient's `expiresAt` timestamp is computed as `sentAt + expirationPeriod`
4. If a recipient accesses the signing page after their `expiresAt`, they see a full-screen message: "This document has expired. Please contact the sender for a new copy."
5. A cron job runs every 15 minutes to sweep expired recipients and transition document status
6. When all pending recipients have expired (none signed), the document workflow status transitions to `expired`
7. The sender receives an email notification when a document expires
8. Sender can "re-send" an expired document, which resets expiration and generates new tokens

### Schema Changes

#### Modify: `documents` (in `apps/backend/convex/schemas/documents.ts`)

```typescript
// New field
expirationPeriod: v.optional(v.object({
  amount: v.number(),                                    // e.g., 30
  unit: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
})),
```

#### Modify: `document_recipients` (in `apps/backend/convex/schemas/recipients.ts`)

```typescript
// New field
expiresAt: v.optional(v.number()),           // Timestamp when this recipient's access expires
expirationNotifiedAt: v.optional(v.number()), // When expiration notification was sent (idempotency guard)
```

#### Modify: `document_workflow_status` (add new status)

```typescript
// Add to the union
v.literal("expired"),
```

#### Modify: `audit_logs` (in `apps/backend/convex/schemas/audit_logs.ts`)

```typescript
// Add new action types to auditActionTuple
v.literal("document.expired"),
v.literal("recipient.expired"),
```

### Backend Implementation

#### Expiration Computation (mutation)

When `markDocumentAsSent` fires (existing mutation), if the document has an `expirationPeriod`, compute `expiresAt` for each recipient:

```
expiresAt = sentAt + convertToMs(expirationPeriod.amount, expirationPeriod.unit)
```

Conversion: `day` = 86400000ms, `week` = 604800000ms, `month` = 2592000000ms (30 days).

#### Expiration Sweep Cron (new internal mutation)

- Register in `crons.ts`: every 15 minutes, call `internal.documents.expiration.sweepExpiredRecipients`
- Query: all `document_recipients` where `expiresAt < Date.now()` AND `status === "pending"` AND `expirationNotifiedAt IS NULL`
- Process up to 100 recipients per run (Convex mutation time budget)
- For each expired recipient:
  1. Set recipient status to `"expired"` (dedicated status — NOT `"declined"`, which is a distinct user action)
  2. Set `expirationNotifiedAt` to `Date.now()` (idempotency)
  3. Log `recipient.expired` audit event
- After processing recipients, check each affected document: if all recipients are either `signed`, `expired`, or `declined`, and at least one expired, transition document to `expired` workflow status

> **Note**: The `"expired"` status must also be added to `recipientStatusTuple` in `document_recipients.ts`. This is distinct from `"declined"` — a declined recipient actively refused, while an expired recipient simply ran out of time. The `WORKFLOW_TRANSITIONS` map in `document_workflow_status.ts` must be updated to allow `sent → expired` and `in_progress → expired`.
- Schedule sender notification email for each newly expired document

#### Signing Page Gate

In the signing page loader (`sign.$token.tsx`), after resolving the recipient:

```
if (recipient.expiresAt && recipient.expiresAt < Date.now()) {
  render <DocumentExpiredPage />  // Full-screen "this document has expired" message
}
```

This provides instant feedback even between cron sweeps.

#### Re-send Expired Document

Extend the existing "resend" functionality:
- Reset `expiresAt` on all pending recipients (recompute from now + expirationPeriod)
- Clear `expirationNotifiedAt`
- Transition document back to `sent` status if it was `expired`
- Generate new signing tokens for expired recipients

### Frontend

#### Document Settings Panel

Add an **"Expiration"** section below the existing deadline field:

- Dropdown with preset durations + "Custom" option
- Custom: number input (1-365) + unit selector (days/weeks/months)
- Helper text: "Recipients will have X days to sign after the document is sent"
- Clear button to remove expiration

#### Document Detail Page

- Show expiration status in the document header: "Expires in 14 days" or "Expired on Feb 25, 2026"
- Per-recipient row: show "Expires Feb 25" badge or "Expired" badge in red
- Action button: "Extend Expiration" (re-computes expiresAt from now)

#### Documents List

- Add "Expired" filter chip alongside existing status filters
- Expired documents show with a distinct visual treatment (muted row, clock icon)

#### Expired Signing Page

New component: full-screen message with:
- Seal logo
- "This document has expired"
- "The sender set an expiration date that has passed. Please contact them for a new signing link."
- Sender's name (but not email, for privacy)

### Permissions

No new permissions needed. Expiration is configured by whoever has `documents:edit` permission. The cron job runs as a system actor.

### Plan Gating

| Feature | Free | Pro |
|---------|------|-----|
| Expiration (preset durations) | 30-day minimum only | Any duration |
| Custom expiration | No | Yes |
| Re-send expired documents | Yes (same limits) | Yes |

Free plan validation: if `expirationPeriod` converts to less than 30 days, reject with "Upgrade to Pro for shorter expiration periods."

### What We Skip (v1)

- No per-recipient expiration overrides (all recipients share the document's expiration period)
- No "expiring soon" reminder emails (separate from existing reminders)
- No automatic re-send on expiration (sender must manually re-send)
- No expiration for documents already in `in_progress` status (at least one signer has signed)
- No timezone-aware expiration (all UTC)

### Signing Page Interaction Order

When multiple features modify the signing page (`sign.$token.tsx`), they must be evaluated in this order:

1. **Expiration gate** (this feature) — if expired, block immediately, show expired message
2. **Authentication gate** (recipient auth design) — if SMS/ID required, verify before showing document
3. **Normal signing flow** — render document and fields
4. **Dictation dialog** (dictate-next-signer design) — after signing, if next recipient is placeholder
5. **Redirect** (custom-redirect design) — after signing (and after dictation if applicable), redirect to URL

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/backend/convex/schemas/documents.ts` | Modify — add `expirationPeriod` field |
| `apps/backend/convex/schemas/recipients.ts` | Modify — add `expiresAt`, `expirationNotifiedAt` fields, add `"expired"` to `recipientStatusTuple` |
| `apps/backend/convex/schemas/document_workflow_status.ts` | Modify — add `"expired"` literal, update `WORKFLOW_TRANSITIONS` |
| `apps/backend/convex/schemas/audit_logs.ts` | Modify — add `document.expired`, `recipient.expired` actions |
| `apps/backend/convex/documents/expiration.ts` | Create — sweep mutation, re-send logic |
| `apps/backend/convex/crons.ts` | Modify — register 15-minute sweep cron |
| `apps/backend/convex/documents/mutations.ts` | Modify — compute `expiresAt` in send flow |
| `apps/web/src/routes/sign.$token.tsx` | Modify — add expiration gate |
| `apps/web/src/components/signing/document-expired-page.tsx` | Create — expired message page |
| `apps/web/src/components/documents/document-settings-panel.tsx` | Modify — add expiration section |
| `packages/transactional/emails/document-expired.tsx` | Create — sender notification email |
