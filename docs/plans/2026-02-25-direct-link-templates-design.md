# Direct Link Templates — Design Document

> **Status:** NOT STARTED

## Goal

Allow template owners to generate a shareable public URL for a template. When a visitor opens the link, they enter their name and email, a new document is atomically created from the template, and they are immediately placed into the signing flow. This eliminates the manual step of the sender creating a document and adding the recipient each time.

## Current State

Today, creating a document from a template requires an authenticated user to: open the template, click "Use Template," add recipients manually, configure fields, and send. There is no way to share a template publicly so that external visitors can self-serve. The `templates` table has no direct link fields, and there is no public-facing route for template-based signing.

## Design

### User Flow: Template Owner

1. Navigate to a template's settings page
2. Toggle **"Direct Link"** on
3. A unique shareable URL is generated: `https://app.seal.so/d/{token}`
4. Owner selects which template recipient role the link visitor will fill (dropdown of existing template recipients — signers only, no CC/viewer/approver)
5. Copy button to copy the URL to clipboard
6. Option to disable/regenerate the link at any time
7. If the template's **structure** is modified after the link was generated (recipients added/removed, fields added/removed/repositioned), the link is automatically invalidated — owner must regenerate it. Non-structural edits (renaming the template, updating description) do NOT invalidate the link.

### User Flow: Visitor (Public)

1. Visitor opens `https://app.seal.so/d/{token}`
2. Landing page shows template name, description, page count, and a form:
   - Name (required)
   - Email (required)
3. Visitor submits → a new document is created atomically from the template:
   - All template fields are copied to the new document
   - The visitor is assigned as the direct link recipient
   - Other template recipients (if any) are copied as-is
4. Visitor is immediately redirected to `/sign/{signingToken}` and enters the standard signing flow
5. After signing, the document owner receives the standard "document signed" notification

### Schema Changes

#### Modify: `templates`

```typescript
// Add these optional fields
directLinkToken: v.optional(v.string()),          // Unique nanoid token for the public URL
directLinkEnabled: v.optional(v.boolean()),        // Whether the link is active
directLinkRecipientId: v.optional(v.id("document_recipients")),  // Which template recipient position the visitor fills (references template recipients, not fields)
directLinkGeneratedAt: v.optional(v.number()),     // Timestamp when link was generated — used for staleness check
```

New index: `by_direct_link_token` on `["directLinkToken"]` (unique lookup)

```typescript
// Also add to templates schema — tracks when structural changes happen (recipients or fields added/removed/reordered)
structureUpdatedAt: v.optional(v.number()),  // Updated ONLY on recipient/field structural changes, NOT on name/description edits
```

Update the template mutations that modify recipients or fields to set `structureUpdatedAt: Date.now()`. Mutations that only change name, description, or metadata should NOT touch this field.

#### No New Tables

All direct link state lives on the template record. No separate `template_direct_links` table is needed since a template has at most one direct link.

### Backend Implementation

#### Mutations

- **`enableDirectLink`** — Sets `directLinkEnabled: true`, generates a `directLinkToken` (nanoid, 21 chars), records `directLinkGeneratedAt: Date.now()`, and stores the selected `directLinkRecipientId`. Validates that the selected recipient has role "signer" on the template. Requires `templates:edit` permission.
- **`disableDirectLink`** — Sets `directLinkEnabled: false`. Token is preserved (not cleared) so it can be re-enabled without changing the URL.
- **`regenerateDirectLink`** — Generates a new `directLinkToken` and updates `directLinkGeneratedAt`. Used after template edits invalidate the previous link.

#### Actions

- **`createDocumentFromDirectLink`** — Public (no auth required). This is the core action, called when a visitor submits their name and email:
  1. Look up template by `directLinkToken`
  2. Validate: `directLinkEnabled === true`
  3. **Staleness check**: compare `template.structureUpdatedAt` against `directLinkGeneratedAt` — if the template's structure (recipients or fields) was updated after the link was generated, reject with error "This link is outdated. Please contact the sender for an updated link." Non-structural edits (name, description) do NOT trigger staleness.
  4. **Atomic document creation** (single mutation internally):
     - Create new `documents` record from template (copy PDF storageId, metadata, etc.)
     - Copy all `template_fields` → `signature_fields` on the new document
     - Create `document_recipients` from template recipient configuration:
       - For the direct link recipient position: use the visitor's name and email, generate signing token
       - For all other template recipients: copy as-is from template
     - Log `document.created` audit event with `source: "direct_link"`
  5. Return the signing token for the visitor's recipient record

#### Rate Limiting

- Rate limit `createDocumentFromDirectLink` by IP: max 10 documents per hour per IP
- Rate limit by template: max 100 documents per hour per template (prevents abuse of a single link)

#### Queries

- **`getDirectLinkTemplate`** — Public query. Given a token, returns template name, description, page count, and whether the link is valid. Does not expose template fields or PDF content.

### Frontend

#### Template Settings: Direct Link Section

Located in the template detail/settings page:
- Toggle switch: "Enable Direct Link"
- When enabled: shows the generated URL with copy button
- Recipient selector dropdown: "Visitor fills the role of: [Signer 1]"
- Warning banner if template has been modified since link generation: "Template was updated. Regenerate the link for visitors to get the latest version."
- "Regenerate Link" button (creates new token, invalidates old URL)

#### Public Route: `/d/$token`

- Unauthenticated route (outside the `_authenticated` layout)
- Minimal UI: Seal logo, template name, description
- Form: Name input, Email input, "Continue to Sign" button
- Loading state while document is being created
- Error states: invalid token, disabled link, outdated link, rate limited
- On success: redirect to `/sign/{signingToken}`

### Permissions

No new permissions. Direct link management uses existing `templates:edit` permission. The public route requires no authentication.

### Plan Gating

| Feature | Free | Pro |
|---------|------|-----|
| Direct link templates | No | Yes |

### What We Skip (v1)

- No custom branding on the direct link landing page (uses default Seal branding)
- No CAPTCHA on the visitor form (rate limiting provides abuse protection)
- No multi-signer direct links (only one recipient position can be the "visitor" role)
- No password-protected direct links
- No expiration date on direct links (only manual disable or template-edit invalidation)
- No analytics dashboard for direct link usage (document list shows created documents)
- No custom redirect URL after signing completion (uses standard Seal completion page) — but if the document has a `redirectUrl` set (see custom-redirect design), that takes effect after signing

> **Implementation pattern reference**: The Plasma storefront app (`/Users/shlomokabareti/Projects/plasma`) uses an identical pattern — token-based public access with `by_access_token` index and a public query that resolves data without authentication. See `apps/storefront/src/routes/my-orders.$token.tsx` and `apps/backend/convex/storefront.ts` (`getCustomerOrdersByToken`). Reuse this pattern for `getDirectLinkTemplate` and the `/d/$token` route.

### Key Files to Modify/Create

| File | Action |
|------|--------|
| `apps/backend/convex/schemas/templates.ts` | Modify — add direct link fields, `structureUpdatedAt`, and index |
| `apps/backend/convex/templates/mutations.ts` | Modify — add enable/disable/regenerate mutations |
| `apps/backend/convex/templates/actions.ts` | Create or modify — `createDocumentFromDirectLink` action |
| `apps/backend/convex/templates/queries.ts` | Modify — add `getDirectLinkTemplate` public query |
| `apps/web/src/routes/d.$token.tsx` | Create — public direct link landing page |
| `apps/web/src/components/templates/direct-link-settings.tsx` | Create — settings section component |
| `apps/web/src/routes/_authenticated/$slug/templates.tsx` | Modify — integrate direct link settings in template detail |
