# Assistant Recipient Role — Design Document

> **Status:** NOT STARTED

## Goal

Add an "assistant" recipient role that allows a designated person to fill in all form fields (text, date, checkbox, dropdown, radio, attachment) on behalf of another recipient — except for signature fields. This is useful when someone other than the signer has the relevant data (e.g., an HR coordinator filling employee details before the employee signs, or a paralegal preparing a contract for a client's signature).

## Current State

Seal supports three recipient roles: `signer` (must sign), `viewer` (view only), `approver` (must approve before signing proceeds). There is no way for one person to fill fields assigned to a different recipient. The `recipientRoleTuple` in `document_recipients.ts` is a union of three literals. The signing page renders all fields assigned to the current recipient and allows them to fill everything including signatures.

## Design

### User Flow: Sender

1. When adding recipients to a document, a new role option **"Assistant"** appears in the role dropdown alongside Signer, Viewer, and Approver
2. After selecting "Assistant," sender must choose **which recipient the assistant is assisting** (dropdown of other recipients — signers and approvers only)
3. Tooltip on the Assistant role: "Can fill in all fields except signatures for the selected recipient. The signer will review and add their signature."
4. The assistant appears in the recipient list with a visual indicator showing who they assist (e.g., "Assistant for John Doe")
5. Signing order: the assistant must complete before the recipient they are assisting

### User Flow: Assistant (Signing Page)

1. Assistant receives email: "You've been asked to assist with filling out a document"
2. Assistant opens their signing link → lands on the signing page
3. Page shows a banner: "You are assisting [Recipient Name] — fill in the fields below. Signature fields will be completed by the signer."
4. All non-signature fields assigned to the assisted recipient are displayed and editable
5. Signature fields are visible but disabled/grayed out with label "To be completed by [Recipient Name]"
6. Assistant fills in the fields and clicks "Submit"
7. After submission, the assisted recipient receives a notification: "[Assistant Name] has filled in fields for your review. Please review and sign."

### User Flow: Signer (After Assistant Completes)

1. Signer receives notification that fields have been pre-filled
2. Signer opens their signing link → sees all fields pre-filled by the assistant
3. Signer can review and modify any pre-filled field values
4. Signer adds their signature to signature fields
5. Signer submits — standard completion flow

### Schema Changes

#### Modify: `document_recipients` (recipientRoleTuple)

```typescript
// Current
export const recipientRoleTuple = v.union(
  v.literal("signer"),
  v.literal("viewer"),
  v.literal("approver"),
);

// New
export const recipientRoleTuple = v.union(
  v.literal("signer"),
  v.literal("viewer"),
  v.literal("approver"),
  v.literal("assistant"),  // New role
);
```

#### Modify: `document_recipients` (new fields)

```typescript
// Add to documentRecipientsTable
assistingRecipientId: v.optional(v.id("document_recipients")),  // Who this assistant is helping
assistedAt: v.optional(v.number()),  // When the assistant completed their work
```

#### Modify: `recipientStatusTuple`

```typescript
// Add new status for assistant completion
v.literal("assisted"),  // Assistant has filled in fields (assistant-only status)
```

### Backend Implementation

#### Mutations

- **`addRecipient`** (modify existing) — When role is "assistant," require `assistingRecipientId` pointing to another recipient in the same document. Validate: the assisted recipient must have role "signer" or "approver" (cannot assist a viewer, CC, or another assistant). Validate: only one assistant per assisted recipient (no stacking).

- **`submitAssistantFields`** (new) — Called when assistant submits their work:
  1. Validate the calling recipient has role "assistant" and status "pending" or "viewed"
  2. Save all submitted field values to the `signature_fields` table (same as regular field submission, but skip signature-type fields)
  3. Update the assistant's status to "assisted" and set `assistedAt`
  4. Schedule notification email to the assisted recipient: "Fields have been pre-filled for your review"
  5. Log audit event: `recipient.assisted`

- **`submitRecipientSignature`** (modify existing) — No changes needed. The signer submits as normal. Pre-filled field values are already stored on the signature_fields; the signer can overwrite them before signing.

#### Queries

- **`getFieldsForAssistant`** (new) — Returns all fields assigned to the assisted recipient, but filters out signature-type fields. Returns field metadata + any existing values. Used by the assistant signing page.

- **`getRecipientDetails`** (modify existing) — Include `assistingRecipientId` and the assisted recipient's name in the response, so the signing page can display "You are assisting [Name]."

#### Signing Order Enforcement

When the document uses sequential signing mode, the assistant's order must be less than the assisted recipient's order (assistant goes first). The `addRecipient` mutation should enforce this by **re-indexing all signing orders as sequential integers** (1, 2, 3...) with the assistant inserted immediately before the assisted recipient. Do NOT use fractional ordering (e.g., `order - 0.5`) as it breaks down with multiple insertions and creates non-deterministic ordering.

For parallel signing mode, the system should still enforce that the assistant's signing link is sent first and the assisted recipient's link is held until the assistant completes. This creates a partial-sequential dependency: the assistant and their assisted recipient are sequential relative to each other, but parallel relative to all other recipients.

#### Email Template

New transactional email: `AssistantRequestEmail`
- Subject: "You've been asked to assist with a document"
- Body: "Hi [Name], [Sender] has asked you to fill in details for [Document Name] on behalf of [Signer Name]. Please review and complete the required fields."
- CTA button: "Fill in Fields"

New transactional email: `AssistantCompletedEmail`
- Subject: "Fields have been filled in for your review"
- Body: "Hi [Signer Name], [Assistant Name] has filled in fields for [Document Name]. Please review the details and add your signature."
- CTA button: "Review & Sign"

### Frontend

#### Recipient Form (Add/Edit Recipient)

- New "Assistant" option in role dropdown
- When "Assistant" is selected, a secondary dropdown appears: "Assisting: [select recipient]"
- Only signers and approvers appear in the secondary dropdown
- Visual indicator in the recipient list: "Assistant for [Name]" with a link icon

#### Signing Page (Assistant View)

- Banner at top: "You are assisting [Recipient Name]"
- Renders all non-signature fields for the assisted recipient
- Signature fields shown but disabled with overlay text: "To be signed by [Name]"
- Submit button text: "Submit Fields" (not "Sign")
- Confirmation dialog: "Submit these fields? [Recipient Name] will be notified to review and sign."

#### Signing Page (Signer View — After Assistant)

- Info banner: "Fields were pre-filled by [Assistant Name] on [date]. Please review before signing."
- All pre-filled fields are editable (signer has final authority)
- Standard signing flow otherwise

### Audit Trail

New audit action types:
- `recipient.assisted` — Assistant submitted fields for another recipient
- `field.prefilled_by_assistant` — Individual field value set by assistant (optional granularity — may skip v1)

### Permissions

No new permissions needed. Who can add recipients (and thus assign assistants) is controlled by existing `documents:edit` permission.

### Plan Gating

| Feature | Free | Pro |
|---------|------|-----|
| Assistant role | No | Yes |

### What We Skip (v1)

- No assistant for template recipients (assistants are configured per-document only, not saved in templates)
- No multiple assistants per signer (one assistant per assisted recipient)
- No assistant-to-assistant chaining (an assistant cannot assist another assistant)
- No partial submission (assistant must fill all required non-signature fields before submitting)
- No real-time collaboration (assistant fills and submits; signer reviews later, not simultaneously)
- No assistant role for CC recipients (CC has no fields to fill)
- No field-level locking after assistant submits (signer can change everything)

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/backend/convex/schemas/document_recipients.ts` | Modify — add `assistant` to role tuple, add `assistingRecipientId` and `assistedAt` fields, add `assisted` status |
| `apps/backend/convex/documents/mutations.ts` | Modify — update `addRecipient` to handle assistant role validation |
| `apps/backend/convex/documents/assistant.ts` | Create — `submitAssistantFields` mutation, `getFieldsForAssistant` query |
| `apps/backend/convex/schemas/audit_logs.ts` | Modify — add `recipient.assisted` action type |
| `apps/web/src/routes/sign.$token.tsx` | Modify — detect assistant role, render assistant-specific UI |
| `apps/web/src/components/signing/assistant-signing-view.tsx` | Create — assistant-specific signing page layout |
| `apps/web/src/components/documents/add-recipient-dialog.tsx` | Modify — add assistant role option and "assisting" recipient picker |
| `packages/transactional/emails/assistant-request.tsx` | Create — email template for assistant invitation |
| `packages/transactional/emails/assistant-completed.tsx` | Create — email template for signer notification |
