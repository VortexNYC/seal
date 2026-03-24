# Delegate Document Ownership — Design Document

> **Status:** NOT STARTED

## Goal

Allow document owners and organization admins to transfer ownership of a document to another member of the same organization. This supports workflows where one person prepares documents on behalf of another — e.g., a legal assistant prepares contracts that should be "from" the attorney, or an HR coordinator sets up offer letters that should come from the hiring manager.

## Current State

- Every document has an `ownerId` field (`v.id("users")`) set at creation time to the creating user
- The `ownerId` determines who "owns" the document for RLS purposes — the owner always has full access
- There is no mechanism to change `ownerId` after creation
- The document detail page shows the creator's name/avatar as the document owner
- Emails to recipients show the sender as the document owner
- Access control in `auth/access_control.ts` uses `ownerId` to determine "owner" access level

## Design

### User Flow

#### UI Transfer (Document Actions)

1. Document owner or org admin opens a document's detail page
2. In the actions dropdown (top-right), they see **"Transfer Ownership"**
3. Clicking opens a dialog:
   - Searchable dropdown of organization members (excludes current owner)
   - Only shows members with `documents:edit` permission
   - Confirmation text: "Transfer ownership of [Document Name] to [Selected User]? They will become the new owner and you will retain edit access."
4. On confirm:
   - `ownerId` is updated to the selected user
   - The new owner receives an email notification: "You are now the owner of [Document Name]"
   - An audit log entry records the transfer
5. The previous owner retains access based on the document's sharing mode (if `workspace`, they keep access; if `private`, they lose access). **If the document is private, the UI warns the transferring owner before confirming.**

#### API Transfer

- `PATCH /api/v1/documents/:id` with `{ ownerId: "new_user_id" }` — same validation as UI
- Requires `seal:documents:write` API scope
- The `delegateOwnership` organization setting must be enabled

### Schema Changes

#### Modify: `organizations` (in `apps/backend/convex/schemas/organizations.ts`)

```typescript
// Add to the organization schema (top-level, not nested in a settings object)
delegateOwnership: v.optional(v.boolean()),  // Whether ownership transfer is enabled (default: false)
```

#### Modify: `audit_logs` (in `apps/backend/convex/schemas/audit_logs.ts`)

```typescript
// Add new action type to auditActionTuple
v.literal("document.ownership_transferred"),
```

No changes to the `documents` schema — the existing `ownerId` field is reused.

### Backend Implementation

#### New Mutation: `transferDocumentOwnership`

Location: `apps/backend/convex/documents/mutations.ts`

```
transferDocumentOwnership:
  Args:
    documentId: Id<"documents">
    newOwnerId: Id<"users">

  Validation:
    1. Caller must be the current document owner OR have admin/owner role in the org
    2. Organization must have delegateOwnership === true
    3. New owner must be a member of the same organization
    4. New owner must have "documents:edit" permission
    5. New owner must not be the same as current owner
    6. Document must not be in "deleted" status

  Effects:
    1. Update document.ownerId to newOwnerId
    2. Update document.updatedAt
    3. Create audit log entry:
       - action: "document.ownership_transferred"
       - oldValues: { ownerId: previousOwnerId }
       - newValues: { ownerId: newOwnerId }
       - metadata.description: "Document ownership transferred from [old] to [new]"
    4. Schedule notification email to new owner
```

#### Organization Setting Mutation

Extend existing organization settings mutations to accept `delegateOwnership` boolean. Only org admins/owners can toggle this.

#### API Endpoint

Modify `PATCH /api/v1/documents/:id` handler to accept `ownerId` in the request body. When `ownerId` is provided:

- Call `transferDocumentOwnership` internally
- Return updated document

### Frontend

#### Transfer Ownership Dialog

New component: `TransferOwnershipDialog`

- Trigger: menu item in document actions dropdown
- Content:
  - Searchable combobox listing org members (fetched via existing team members query)
  - Filter out current owner and members without `documents:edit` permission
  - Shows member avatar, name, email, and role
  - Confirmation button: "Transfer Ownership"
- On success: toast "Ownership transferred to [name]", refresh document data
- On error: toast with error message

#### Document Detail Page

- If the current user is not the owner but is an admin, show "Transfer Ownership" in actions
- After transfer, the document header updates to show the new owner
- If the previous owner loses access (private sharing mode), they are redirected to the documents list

#### Organization Settings

Add toggle under **Settings > General** (or a new **Settings > Security** section):

- "Allow document ownership transfer"
- Description: "When enabled, document owners and admins can transfer document ownership to other organization members"
- Default: off

### Permissions

No new permission keys needed. The transfer action requires:

- The caller to be the document owner OR have admin/owner org role
- The `delegateOwnership` organization setting to be enabled
- The target user to have `documents:edit` permission

### Plan Gating

| Feature            | Free | Pro |
| ------------------ | ---- | --- |
| Transfer ownership | No   | Yes |

Free plan: the "Transfer Ownership" menu item is hidden entirely.

### What We Skip (v1)

- No bulk ownership transfer (one document at a time)
- No ownership transfer history page (rely on audit logs)
- No "transfer back" shortcut (new owner must initiate a separate transfer)
- No ownership transfer for templates (documents only)
- No automatic sharing mode adjustment — if the document is `private`, the previous owner loses access. **The transfer dialog must show a warning**: "This document's sharing mode is set to Private. After transfer, you will lose access to this document." with a checkbox to acknowledge before confirming
- No approval workflow (transfer is immediate, no "accept ownership" step for the new owner)
- No ownership transfer while document is in `sent` or `in_progress` status (only `draft`, `completed`, `cancelled`, `expired`, `declined`)

### Key Files to Modify/Create

| File                                                                 | Action                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/backend/convex/schemas/organizations.ts`                       | Modify — add `delegateOwnership` field                 |
| `apps/backend/convex/schemas/audit_logs.ts`                          | Modify — add `document.ownership_transferred` action   |
| `apps/backend/convex/documents/mutations.ts`                         | Modify — add `transferDocumentOwnership` mutation      |
| `apps/backend/convex/organizations/mutations.ts`                     | Modify — accept `delegateOwnership` in settings update |
| `apps/backend/convex/api/v1/documents.ts`                            | Modify — accept `ownerId` in PATCH endpoint            |
| `apps/web/src/components/documents/transfer-ownership-dialog.tsx`    | Create — transfer dialog component                     |
| `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx` | Modify — add "Transfer Ownership" to actions dropdown  |
| `apps/web/src/routes/_authenticated/$slug/settings/index.tsx`        | Modify — add delegate ownership toggle                 |
| `packages/transactional/emails/ownership-transferred.tsx`            | Create — new owner notification email                  |
