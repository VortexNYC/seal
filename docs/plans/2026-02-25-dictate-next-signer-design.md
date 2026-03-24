# Dictate Next Signer — Design Document

> **Status:** NOT STARTED

## Goal

When a document uses sequential signing order, allow the current signer to specify who the next signer should be. This supports workflows where the signing chain is not fully known upfront — e.g., a field technician signs a work order and then designates which supervisor should approve it, or a sales rep signs a proposal and chooses which client contact should countersign.

## Current State

- Documents support `signingMode: "sequential"` which enforces signing order via the `signingOrder` field on each recipient
- All recipients must be fully defined (name + email) before the document is sent
- After signing, the system automatically sends the invitation to the next recipient in order
- There is no mechanism for a signer to influence who comes next — the recipient list is fixed at send time
- The post-signing screen shows a static "Thank you" message

## Design

### User Flow

#### Sender Configuration

1. Sender creates a document with **sequential signing** enabled
2. For any recipient in the chain, sender can toggle **"Let this signer choose the next recipient"**
3. When enabled, the next recipient in the sequence becomes a placeholder: name and email fields show as "To be determined by [previous signer's name]"
4. The placeholder recipient still needs a role assigned (Signer, Approver, etc.) and any fields placed on the document

#### Signer Experience

1. A signer completes their signature on the document
2. Instead of the standard "Thank you" page, they see a **"Choose Next Signer"** dialog:
   - "Who should sign next?"
   - Name input (required)
   - Email input (required, validated)
   - Pre-filled with existing next recipient info if the sender partially filled it
3. On submit:
   - The next recipient's name and email are updated
   - A signing invitation email is sent to the designated person
   - The signer sees the standard "Thank you" confirmation
4. If the signer closes the dialog without submitting, the document is blocked — the next recipient cannot be notified until the current signer provides the info
   - A "Complete next signer selection" reminder is sent after 24 hours to the signer
   - The document owner/sender is also notified that the signing chain is blocked: "[Signer Name] signed the document but has not yet designated the next signer"

### Schema Changes

#### Modify: `documents` (in `apps/backend/convex/schemas/documents.ts`)

```typescript
// New field
allowDictateNextSigner: v.optional(v.boolean()),  // Enable "choose next signer" flow
```

#### Modify: `document_recipients` (in `apps/backend/convex/schemas/recipients.ts`)

```typescript
// New fields
isPlaceholder: v.optional(v.boolean()),          // True if name/email are TBD (to be filled by previous signer)
dictatedBy: v.optional(v.id("document_recipients")),  // Which recipient designated this one
dictatedAt: v.optional(v.number()),              // When the designation happened
awaitingDictation: v.optional(v.boolean()),      // True if previous signer has signed but not yet designated next
```

#### Modify: `audit_logs` (in `apps/backend/convex/schemas/audit_logs.ts`)

```typescript
// Add new action type to auditActionTuple
v.literal("recipient.dictated"),
```

### Backend Implementation

#### Send Flow Changes

When `markDocumentAsSent` processes a sequential document with `allowDictateNextSigner`:

- Placeholder recipients (where `isPlaceholder === true`) are skipped in the initial email send
- Only the first non-placeholder recipient receives an invitation
- Validation: at least the first recipient must have a real name + email (cannot be a placeholder)

#### New Mutation: `dictateNextRecipient`

Location: `apps/backend/convex/documents/mutations.ts`

```
dictateNextRecipient:
  Args:
    recipientId: Id<"document_recipients">   // The current signer's recipient ID
    token: string                             // Current signer's access token (auth)
    nextRecipientName: string
    nextRecipientEmail: string

  Validation:
    1. Token must be valid and belong to the calling recipient
    2. Calling recipient must have status "signed" (just completed signing)
    3. Document must have allowDictateNextSigner === true
    4. Document must have signingMode === "sequential"
    5. Next recipient in order must exist and have isPlaceholder === true OR awaitingDictation === true
    6. Email format validation

  Effects:
    1. Update next recipient: set name, email, clear isPlaceholder, set dictatedBy, dictatedAt
    2. Generate new signing token for the next recipient (since email changed)
    3. Send signing invitation email to the new recipient
    4. Create audit log entry:
       - action: "recipient.dictated"
       - metadata.description: "[signer name] designated [new name] as next signer"
    5. Clear awaitingDictation flag
```

#### Sequential Flow Integration

Modify the existing sequential signing logic (the code that triggers the next recipient's email after a signature):

- Before sending to the next recipient, check if the next recipient `isPlaceholder`
- If yes, set `awaitingDictation: true` on the next recipient and show the dictation dialog instead of sending
- The invitation is deferred until `dictateNextRecipient` is called

#### Reminder for Pending Dictation

If `awaitingDictation` remains true for 24 hours after the previous signer completed:

- Send a reminder email to the previous signer: "You signed [Document Name] but haven't designated the next signer yet"
- Include a link back to the dictation page (a special route or the signing page with a dictation-only mode)
- This can be handled by the existing reminder cron or a new check in the email retry system

### Frontend

#### Document Settings Panel

Add a toggle in the document settings (only visible when `signingMode === "sequential"`):

- "Allow signers to choose the next recipient"
- Description: "When enabled, signers can specify who should sign after them"
- When toggled on, the recipient list UI changes to allow marking recipients as placeholders

#### Recipient List (Document Editor)

When `allowDictateNextSigner` is enabled:

- Each recipient (except the first and last) shows a checkbox: "Placeholder — to be chosen by previous signer"
- When checked, the name and email inputs are replaced with a grey pill: "To be designated by [Previous Signer Name]"
- The role and field assignments remain editable by the sender
- Validation: consecutive placeholders are allowed but discouraged (show warning)

#### Post-Signing Dialog

New component: `DictateNextSignerDialog`

- Appears after successful signature submission when the next recipient is a placeholder
- Modal dialog (cannot be dismissed without action):
  - Title: "Who should sign next?"
  - Subtitle: "As the [role] of this document, please designate the next signer"
  - Name input (required)
  - Email input (required, with format validation)
  - Pre-filled if the sender provided partial info
  - "Send Invitation" button
  - "I'll do this later" link (sets awaitingDictation, shows warning about delay)
- On success: transitions to standard "Thank you" page (or redirect if configured)

#### Signing Page (Dictation-Only Mode)

For the reminder flow, the previous signer returns to `/sign/{token}?dictate=true`:

- The existing signing token is **NOT invalidated** after signing — it remains valid but access is gated by recipient status
- When a token resolves to a recipient with `status: "signed"` and `awaitingDictation: true`, the signing page renders ONLY the `DictateNextSignerDialog` (no document, no fields, no re-signing)
- When a token resolves to a recipient with `status: "signed"` and `awaitingDictation: false` (dictation already completed), show "You have already completed this step"
- This avoids introducing a second token type — the token's capability is determined by the recipient's state, not by the token itself

### Permissions

No new permissions needed. The dictation action is authenticated via the recipient's signing token — only the signer who just completed can dictate the next recipient. The feature is configured by whoever has `documents:edit` permission.

### Plan Gating

| Feature             | Free | Pro |
| ------------------- | ---- | --- |
| Dictate next signer | No   | Yes |

Free plan: the toggle is hidden in document settings. Sequential signing itself is available on all plans.

### What We Skip (v1)

- No "choose from a list" — the signer types in a name and email freeform (no contact book integration)
- No multi-step dictation (signer can only designate the immediate next recipient, not skip ahead)
- No approval workflow for the dictated recipient (no "sender must approve the choice")
- No dictation for parallel signing mode (sequential only)
- No dictation for CC recipients (signers and approvers only)
- No dictation history UI (rely on audit logs)
- No ability to change the dictated recipient after submission (sender must void and re-send)

### Interaction with Document Expiration

If a document has both `allowDictateNextSigner` and `expirationPeriod` configured:

- The expiration clock ticks regardless of dictation state — if the document expires while awaiting dictation, the document transitions to `expired` status
- The expiration gate on the signing page takes priority over dictation (see "Signing Page Interaction Order" in document-expiration design)
- The sender notification for a blocked dictation chain should mention the expiration deadline if one exists: "...the document will expire on [date] if not completed"

### Key Files to Modify/Create

| File                                                             | Action                                                                               |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/backend/convex/schemas/documents.ts`                       | Modify — add `allowDictateNextSigner` field                                          |
| `apps/backend/convex/schemas/recipients.ts`                      | Modify — add `isPlaceholder`, `dictatedBy`, `dictatedAt`, `awaitingDictation` fields |
| `apps/backend/convex/schemas/audit_logs.ts`                      | Modify — add `recipient.dictated` action                                             |
| `apps/backend/convex/documents/mutations.ts`                     | Modify — add `dictateNextRecipient` mutation, adjust send flow                       |
| `apps/backend/convex/documents/actions.ts`                       | Modify — adjust sequential email logic for placeholders                              |
| `apps/web/src/routes/sign.$token.tsx`                            | Modify — show dictation dialog after signing                                         |
| `apps/web/src/components/signing/dictate-next-signer-dialog.tsx` | Create — dictation dialog component                                                  |
| `apps/web/src/components/documents/document-settings-panel.tsx`  | Modify — add dictation toggle                                                        |
| `apps/web/src/components/documents/recipient-list.tsx`           | Modify — placeholder recipient UI                                                    |
| `packages/transactional/emails/dictation-reminder.tsx`           | Create — reminder email for pending dictation                                        |
