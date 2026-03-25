# Custom Redirect After Signing — Design Document

> **Status:** NOT STARTED

## Goal

Allow senders to configure a custom redirect URL that recipients are sent to after completing their signature. This enables seamless integration with external workflows — e.g., redirecting to an onboarding portal after signing an employment agreement, or back to a partner's website after signing a contract. The redirect URL receives query parameters with signing context so the destination can react to the completed signature.

## Current State

- After signing, recipients see a static "Thank you" confirmation page within Seal
- The `embeddingConfig` object on documents already has a `redirectUrl` field, but this is scoped to embedded/iframe signing only — it does not apply to standard email-link signing
- No top-level redirect URL field exists on the document schema
- The REST API has no support for setting a redirect URL

## Design

### User Flow

1. Sender opens **Document Settings** while preparing a document (draft state)
2. Under a new **"After Signing"** section, sender enters a redirect URL (e.g., `https://portal.acme.com/onboarding`)
3. URL is validated client-side and server-side: must be a valid URL with `http://` or `https://` protocol
4. When a recipient completes signing, instead of the "Thank you" page, they are redirected to the configured URL
5. The redirect includes query parameters so the destination knows what happened:
   - `?recipientEmail={email}&recipientName={name}&status=signed`
   - Note: We intentionally omit internal Convex document IDs from query params to avoid leaking internal identifiers. If the destination needs to correlate, they should use webhooks or the API with the recipient email.
6. If the redirect URL is unreachable or invalid at signing time, fall back to the standard "Thank you" page
7. A 5-second countdown is shown before redirect: "You will be redirected to [domain] in 5 seconds..." with a "Go now" link and a "Stay here" button

### Schema Changes

#### Modify: `documents` (in `apps/backend/convex/schemas/documents.ts`)

```typescript
// New field
redirectUrl: v.optional(v.string()),  // URL to redirect recipients to after signing
```

No new indexes needed — this field is only read when rendering the post-signing page.

### Backend Implementation

#### Validation

Add URL validation in the document update mutation (`documents/mutations.ts`):

```typescript
function validateRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
```

Reject URLs with:

- Non-http/https protocols (`javascript:`, `data:`, `ftp:`, etc.)
- URLs longer than 2048 characters

#### Mutation Changes

- Modify `updateDocument` mutation: accept optional `redirectUrl` field, validate if provided
- Modify `createDocument` mutation: accept optional `redirectUrl` field
- API endpoint `POST /api/v1/documents` and `PATCH /api/v1/documents/:id`: accept `redirectUrl` in request body

#### Signing Completion Flow

No backend changes needed for the redirect itself — it happens client-side. The existing `submitRecipientSignature` mutation already returns the document data. The signing page component reads `document.redirectUrl` and performs the redirect.

### Frontend

#### Document Settings Panel

Add an **"After Signing"** section below other settings:

- Label: "Redirect after signing"
- Text input with placeholder: `https://example.com/thank-you`
- Inline validation: show error state if URL is invalid or uses non-http protocol
- Helper text: "Recipients will be redirected to this URL after completing their signature"
- Clear button (X icon) to remove the URL

#### Signing Page (`sign.$token.tsx`)

After successful signature submission, check for `document.redirectUrl`:

```
if (document.redirectUrl) {
  render <RedirectCountdown url={document.redirectUrl} params={signingContext} />
} else {
  render <ThankYouPage />  // Current behavior
}
```

#### Redirect Countdown Component

New component `RedirectCountdown`:

- Shows: "Signing complete! You will be redirected to **[domain name only]** in 5 seconds..."
- Countdown timer: 5, 4, 3, 2, 1, then `window.location.href = urlWithParams`
- "Go now" link to skip countdown
- "Stay here" button to cancel redirect and show the standard thank you page
- Only show the domain name (not full URL) to avoid phishing concerns with long URLs

#### Query Parameter Construction

Build the redirect URL with appended query params:

```typescript
const redirectWithParams = new URL(document.redirectUrl);
// No internal document ID — avoid leaking Convex IDs
redirectWithParams.searchParams.set("recipientEmail", recipient.email);
redirectWithParams.searchParams.set("recipientName", recipient.name);
redirectWithParams.searchParams.set("status", "signed");
window.location.href = redirectWithParams.toString();
```

### Permissions

No new permissions needed. Redirect URL is configured by whoever has `documents:edit` permission. Recipients see the redirect behavior passively.

### Plan Gating

| Feature             | Free | Pro |
| ------------------- | ---- | --- |
| Custom redirect URL | No   | Yes |

Free plan: the redirect URL input is visible but disabled with a "Pro" badge and upgrade prompt.

### What We Skip (v1)

- No per-recipient redirect URLs (all recipients share the same redirect)
- No redirect for declined signatures (only successful signing triggers redirect)
- No server-side redirect (all client-side via `window.location.href`)
- No webhook-style POST to the redirect URL (it is a simple GET redirect with query params)
- No redirect URL templating/variables beyond the fixed query params
- No redirect URL allowlist at the organization level (any valid http/https URL is accepted)

### Interaction with Dictate Next Signer

When a document has both `redirectUrl` and `allowDictateNextSigner` enabled:

1. **Dictation takes priority over redirect**: If the signer needs to designate the next signer, the `DictateNextSignerDialog` is shown first
2. After the signer completes dictation (or selects "I'll do this later"), THEN the redirect countdown begins
3. Order: Signing → Dictation dialog (if applicable) → Redirect countdown (if configured) → Standard thank-you page (fallback)

See the "Signing Page Interaction Order" section in the document-expiration design for the complete priority chain.

### Key Files to Modify/Create

| File                                                            | Action                                     |
| --------------------------------------------------------------- | ------------------------------------------ |
| `apps/backend/convex/schemas/documents.ts`                      | Modify — add `redirectUrl` field           |
| `apps/backend/convex/documents/mutations.ts`                    | Modify — accept and validate `redirectUrl` |
| `apps/backend/convex/api/v1/documents.ts`                       | Modify — accept `redirectUrl` in API       |
| `apps/web/src/routes/sign.$token.tsx`                           | Modify — check for redirect after signing  |
| `apps/web/src/components/signing/redirect-countdown.tsx`        | Create — countdown + redirect component    |
| `apps/web/src/components/documents/document-settings-panel.tsx` | Modify — add redirect URL input            |
