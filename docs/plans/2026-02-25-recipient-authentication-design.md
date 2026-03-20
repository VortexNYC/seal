# SMS / ID Recipient Authentication — Design Document

> **Status:** SCHEMA STUB ONLY — `v.literal("sms")` exists in recipients schema, no backend/frontend implementation yet.

## Goal

Add stronger recipient authentication methods beyond the current email-token-only approach. Senders should be able to require recipients to verify their identity via SMS code or government ID before accessing a document. This builds trust for high-value contracts and satisfies compliance requirements.

## Current State

- Recipients access documents via `/sign/{token}` — a 64-character hex token in the URL
- Token is SHA-256 hashed and stored; expires after 30 days
- No additional identity verification — anyone with the link can sign
- ESIGN consent dialog gates signing but doesn't verify identity
- No phone number field on the recipient schema

## Design

### Authentication Methods

Three tiers, configurable per-recipient by the sender:

| Method               | How It Works                                        | Cost                                  | Use Case                                 |
| -------------------- | --------------------------------------------------- | ------------------------------------- | ---------------------------------------- |
| **Email (default)**  | Token in signing link — current behavior            | Free                                  | Low-risk documents                       |
| **SMS verification** | Recipient enters a 6-digit code sent to their phone | ~$0.01/SMS (Twilio)                   | Medium-risk: employment agreements, NDAs |
| **ID verification**  | Recipient uploads government ID + selfie            | ~$1.50/verification (Stripe Identity) | High-risk: real estate, financial, legal |

### User Flow: Sender Side

1. When adding recipients to a document, a new **"Authentication"** dropdown per recipient:
   - `Email only` (default)
   - `SMS verification` — requires phone number input
   - `ID verification` — no extra input needed (recipient provides ID at signing time)
2. Option to set a **default authentication level** at the organization level (Settings → Security)
3. Bulk override: "Set all recipients to SMS" button

### User Flow: Recipient Side

#### SMS Verification

1. Recipient clicks signing link → lands on `/sign/{token}`
2. Instead of the document, they see an **SMS verification gate**:
   - "A verification code has been sent to •••••4567"
   - 6-digit code input field
   - "Resend code" link (max 3 resends, 60-second cooldown)
3. On correct code → document renders normally
4. On 5 failed attempts → token locked for 15 minutes
5. SMS code expires after 10 minutes

#### ID Verification

1. Recipient clicks signing link → lands on `/sign/{token}`
2. They see a **Stripe Identity verification gate**:
   - "This document requires identity verification before signing"
   - "Verify your identity" button
3. Stripe Identity embedded component opens (captures ID photo + selfie)
4. On successful verification → document renders
5. Verification result (verified/failed) stored on recipient record
6. If failed → recipient can retry (up to 3 attempts)

### Schema Changes

#### Modify: `document_recipients`

```typescript
// New fields
authenticationMethod: v.optional(v.union(
  v.literal("email"),     // Default — current behavior
  v.literal("sms"),
  v.literal("id_verification"),
)),
phone: v.optional(v.string()),                    // For SMS auth
smsVerificationId: v.optional(v.string()),        // Active verification session
smsVerifiedAt: v.optional(v.number()),            // When SMS was verified
idVerificationSessionId: v.optional(v.string()),  // Stripe Identity session ID
idVerifiedAt: v.optional(v.number()),             // When ID was verified
idVerificationStatus: v.optional(v.union(
  v.literal("pending"),
  v.literal("verified"),
  v.literal("failed"),
)),
authAttempts: v.optional(v.number()),             // Failed attempt counter
authLockedUntil: v.optional(v.number()),          // Lock timestamp after too many failures
```

#### New Schema: `sms_verifications`

```
sms_verifications:
  recipientId: Id<"document_recipients">
  phone: string                    // Normalized E.164 format
  code: string                     // 6-digit code (hashed)
  status: "pending" | "verified" | "expired" | "failed"
  attempts: number                 // Failed code entry attempts
  expiresAt: number                // 10 minutes from creation
  createdAt: number

  Indexes: by_recipient, by_status
```

#### Modify: `organizations`

```typescript
// Add to organization schema
securitySettings: v.optional(
  v.object({
    defaultAuthMethod: v.optional(
      v.union(v.literal("email"), v.literal("sms"), v.literal("id_verification")),
    ),
  }),
);
```

### Backend Implementation

#### SMS (Twilio)

- New Convex action: `sendSmsVerification` — generates 6-digit code, hashes it, stores in `sms_verifications`, sends via Twilio Verify API
- New Convex mutation: `verifySmsCode` — validates code against hash, checks expiry, updates recipient record
- Twilio Verify API handles delivery, retry, and phone number validation
- Environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`

#### ID Verification (Stripe Identity)

- New Convex action: `createIdVerificationSession` — creates a Stripe Identity VerificationSession via Stripe Connect (uses the org's connected Stripe account)
- Frontend embeds `@stripe/react-identity` component
- Stripe webhook `identity.verification_session.verified` / `identity.verification_session.requires_input` updates `idVerificationStatus` on recipient
- Falls back to Seal's platform Stripe account if org has no connected account

#### Signing Page Gate (`sign.$token.tsx`)

```
// Pseudocode
if (recipient.authenticationMethod === "sms" && !recipient.smsVerifiedAt) {
  render <SmsVerificationGate />
} else if (recipient.authenticationMethod === "id_verification" && !recipient.idVerifiedAt) {
  render <IdVerificationGate />
} else {
  render <SigningPage />  // Current behavior
}
```

Both gates are full-screen with the document header visible but content blurred/hidden.

### Audit Trail

All authentication events logged to `audit_logs`:

- `recipient.sms_sent` — SMS verification code sent
- `recipient.sms_verified` — SMS code verified successfully
- `recipient.sms_failed` — SMS code verification failed
- `recipient.id_verification_started` — Stripe Identity session created
- `recipient.id_verified` — ID verification successful
- `recipient.id_verification_failed` — ID verification failed
- `recipient.auth_locked` — Account locked after too many failures

### Certificate of Completion

The existing certificate PDF generator should include the authentication method used:

- "Authenticated via: Email link"
- "Authenticated via: SMS verification to •••••4567"
- "Authenticated via: Government ID verification (Stripe Identity)"

### Permissions

No new permissions — controlled by who can add recipients (existing `documents:edit` permission).

### Plan Gating

| Feature         | Free | Pro |
| --------------- | ---- | --- |
| Email auth      | Yes  | Yes |
| SMS auth        | No   | Yes |
| ID verification | No   | Yes |

SMS and ID verification costs are passed through to the organization (tracked in usage, billed via Stripe).

### What We Skip (v1)

- KBA (Knowledge-Based Authentication) — requires LexisNexis/Equifax integration, complex and expensive
- Phone call verification — lower demand than SMS
- Biometric authentication beyond what Stripe Identity provides
- Custom authentication providers (SAML/OAuth for recipients)
- Access code authentication (sender sets a shared passcode) — simple but lower security than SMS

### Key Files to Modify/Create

| File                                                             | Action                                  |
| ---------------------------------------------------------------- | --------------------------------------- |
| `apps/backend/convex/schemas/recipients.ts`                      | Modify — add auth fields                |
| `apps/backend/convex/schemas/sms_verifications.ts`               | Create                                  |
| `apps/backend/convex/schema.ts`                                  | Modify — register new table             |
| `apps/backend/convex/documents/sms_verification.ts`              | Create — send/verify actions            |
| `apps/backend/convex/documents/id_verification.ts`               | Create — Stripe Identity actions        |
| `apps/backend/convex/schemas/audit_logs.ts`                      | Modify — add new action types           |
| `apps/backend/convex/documents/certificate_of_completion.ts`     | Modify — show auth method               |
| `apps/web/src/routes/sign.$token.tsx`                            | Modify — add auth gates                 |
| `apps/web/src/components/signing/sms-verification-gate.tsx`      | Create                                  |
| `apps/web/src/components/signing/id-verification-gate.tsx`       | Create                                  |
| `apps/web/src/components/documents/add-recipient-dialog.tsx`     | Modify — auth method selector           |
| `apps/backend/convex/schemas/organizations.ts`                   | Modify — add securitySettings           |
| `apps/web/src/routes/_authenticated/$slug/settings/security.tsx` | Create or modify — default auth setting |
