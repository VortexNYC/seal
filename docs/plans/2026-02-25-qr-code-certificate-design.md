# QR Code Verification Certificate — Design Document

> **Status:** DONE

## Goal

Embed a QR code in the certificate of completion PDF that links to a public verification page. Anyone who receives a signed document can scan the QR code to independently verify that the document was signed through Seal, view completion details, and confirm its authenticity. This builds trust in Seal as a signing platform and provides a tamper-evident verification mechanism without requiring an account.

## Current State

- Seal generates a certificate of completion PDF when all recipients sign (`apps/backend/convex/documents/certificate_of_completion.ts`)
- The certificate includes: document name, document ID, page count, signer details with timestamps, signature methods, SHA-256 document hash, and an audit trail timeline
- The certificate PDF is stored in Convex Storage and referenced by `certificateStorageId` on the document
- There is no QR code on the certificate
- There is no public verification page — all document access requires authentication or a signing token
- The document schema has `documentHash` (SHA-256 of the original PDF) for integrity verification

## Design

### User Flow

#### For the Document Sender/Signer

1. Document reaches `completed` status (all signatures collected)
2. The certificate of completion PDF is generated (existing flow)
3. A unique `qrToken` is generated and stored on the document
4. A QR code linking to `https://app.seal.com/verify/{qrToken}` is rendered on the certificate PDF
5. The QR code appears in the bottom-right corner of the certificate's first page, 72x72px with a "Verify this document" caption

#### For Anyone Verifying

1. Person receives a signed document with its certificate of completion
2. They scan the QR code with their phone camera or QR reader app
3. Their browser opens `https://app.seal.com/verify/{qrToken}`
4. The public verification page shows:
   - Seal logo and "Document Verification" header
   - Green checkmark with "Verified" badge (or red X if invalid)
   - Document name
   - Completion date and time
   - Number of signers
   - Signer names with masked emails (e.g., "John Smith — j\*\*\*@acme.com")
   - Document hash (SHA-256) for manual integrity checking
   - Seal branding footer
5. No login or account is required — the page is fully public

### Schema Changes

#### Modify: `documents` (in `apps/backend/convex/schemas/documents.ts`)

```typescript
// New fields
qrToken: v.optional(v.string()),         // Unique token for QR code verification (nanoid)
qrTokenGeneratedAt: v.optional(v.number()), // When the token was generated
```

Add a new index for fast token lookup:

```typescript
.index("by_qr_token", ["qrToken"])
```

### Backend Implementation

#### QR Token Generation

When the document completion flow runs (the existing logic that sets `workflowStatus: "completed"` and triggers certificate generation):

1. Generate a unique token: `nanoid(24)` — 24 characters, URL-safe alphabet
2. Store on the document: `qrToken`, `qrTokenGeneratedAt: Date.now()`
3. Pass the token to the certificate generation action

Token format: `24` characters from nanoid's default alphabet (A-Za-z0-9\_-). This gives ~143 bits of entropy — more than sufficient for a non-secret lookup key.

#### Certificate PDF Modification

Modify `apps/backend/convex/documents/certificate_of_completion.ts`:

1. Accept `qrToken` as a parameter in `generateCertificatePdf`
2. Use the `uqr` library to generate a QR code matrix from the verification URL
3. Convert the QR matrix to a PDF image:
   - Render QR modules as filled squares using pdf-lib's drawing primitives (`page.drawRectangle`)
   - No need for an intermediate PNG — draw directly on the PDF
4. Place the QR code on the certificate's first page:
   - Position: bottom-right corner, `MARGIN` inset from edges
   - Size: 72x72 points (1 inch square)
   - Below the QR: caption text "Scan to verify" in 8pt Helvetica, centered under the QR
5. Error correction level: "Q" (~25% recovery) — handles minor print damage and scanning at angles
6. Quiet zone: 4-module white border around the QR code (standard requirement)

#### Public Verification Query

New file: `apps/backend/convex/documents/verification.ts`

```
getDocumentByQrToken (public query — no auth required):
  Args:
    qrToken: string

  Returns:
    null if token not found, otherwise:
    {
      verified: boolean                    // Always true if found (document exists and is completed)
      documentName: string
      completedAt: number
      signerCount: number
      signers: Array<{
        name: string
        maskedEmail: string               // "j***@acme.com"
        signedAt: number
        role: string
      }>
      documentHash: string | null
      createdAt: number
    }

  Implementation:
    1. Query documents by qr_token index
    2. If not found, return null
    3. If found but workflowStatus !== "completed", return null (shouldn't happen but defensive)
    4. Fetch recipients with status "signed"
    5. Mask emails: show first char + "***" + domain
    6. Return public-safe subset of data (no IDs, no full emails, no file access)
```

This is a **public query** — it does not use `authQuery` or any permission wrappers. It uses the base `query` from Convex.

#### Email Masking Utility

```typescript
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 5))}@${domain}`;
}
```

#### HTTP Route for Verification

Add to `apps/backend/convex/http.ts`:

```
GET /api/verify/{qrToken} → redirect to frontend verification page
```

This is optional — the QR code can link directly to the frontend route. But having an API endpoint allows programmatic verification too.

### Frontend

#### Public Verification Page

New route: `apps/web/src/routes/verify.$qrToken.tsx`

This is a **public route** (not under `_authenticated`). It does not require login.

Layout:

- Centered card on a clean background with Seal branding
- Top: Seal logo
- If token is valid:
  - Green shield checkmark icon
  - "Document Verified" heading
  - Document name (large text)
  - "Completed on [date]" subtitle
  - Divider
  - "Signers" section: list of signer cards, each showing name, masked email, role, signed date
  - "Document Integrity" section: SHA-256 hash in a monospace copyable field
  - Footer: "Verified by Seal — Document Signing Platform" with link to seal.com
- If token is invalid:
  - Red X icon
  - "Verification Failed" heading
  - "This verification link is invalid or the document no longer exists."
  - Link to Seal homepage

Loading state: skeleton with pulsing placeholders.

#### Certificate Download

The existing certificate download flow does not change. The QR code is simply part of the generated PDF.

### Permissions

No permissions needed for the verification page — it is intentionally public. The QR token acts as a capability token: knowing the token grants read access to the limited public verification data.

The token is not secret (it is printed on PDFs that are shared), but the data exposed is minimal and non-sensitive (document name, signer names, masked emails, dates).

### Plan Gating

| Feature                  | Free | Pro |
| ------------------------ | ---- | --- |
| QR code on certificate   | Yes  | Yes |
| Public verification page | Yes  | Yes |

This feature is available on all plans. The verification page promotes Seal's brand and builds trust in the platform — it is a growth/marketing mechanism, not a premium feature.

### What We Skip (v1)

- No `hidePoweredBy` / hide QR option (enterprise feature for a future tier)
- No PDF download from the verification page (viewer sees metadata only, not the document itself)
- No verification API endpoint returning JSON (frontend-only for v1; the public query serves the data)
- No QR code customization (color, logo embedding) — standard black-and-white
- No QR code on the signed document itself (only on the certificate of completion)
- No revocation mechanism (if a document is deleted, the verification page shows "not found")
- No aggressive rate limiting on the verification query — the data is read-only and minimal. If abuse is detected (high request volume from a single IP), add lightweight rate limiting at the Convex HTTP layer. For v1, the public Convex query is sufficient without additional protection.

> **Clerk adds no value here**: The verification page is intentionally public (no account required). Clerk's identity verification features are for authenticating specific users, not for validating document tokens. The simple `qrToken → by_qr_token index → public query` approach is correct.

### Key Files to Modify/Create

| File                                                         | Action                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `apps/backend/convex/schemas/documents.ts`                   | Modify — add `qrToken`, `qrTokenGeneratedAt` fields and `by_qr_token` index |
| `apps/backend/convex/documents/certificate_of_completion.ts` | Modify — generate QR code and embed in PDF                                  |
| `apps/backend/convex/documents/verification.ts`              | Create — public query `getDocumentByQrToken`                                |
| `apps/backend/convex/documents/mutations.ts`                 | Modify — generate `qrToken` on document completion                          |
| `apps/web/src/routes/verify.$qrToken.tsx`                    | Create — public verification page                                           |
