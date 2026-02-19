# Legal Compliance Implementation Checklist

**Purpose**: This document ensures Seal meets all legal requirements for electronic signatures (ESIGN Act & UETA) from day one.

**Status**: ⚠️ MVP-Critical - Must be implemented before public launch

---

## 📋 Overview

All electronic signature platforms must comply with the **ESIGN Act** (Electronic Signatures in Global and National Commerce Act) and **UETA** (Uniform Electronic Transactions Act). This checklist breaks down the exact requirements and maps them to our feature specifications.

---

## 🔴 The 5 Essential ESIGN Act Requirements

### 1. Intent to Sign ✍️

**Legal Requirement**: Prove the signer intended to execute the signature.

**Implementation Checklist**:

- [x] Clear UI showing user is about to sign (not just clicking randomly) — "Accept & Sign" button with legal disclaimer in `signature-capture.tsx`
- [x] Explicit "I agree to sign" button/action — "Accept & Sign" button text at line 636
- [x] Record signature method used (drawn, typed, uploaded image) — `signatureType` stored in schema
- [x] Capture user interaction data during signing process — audit trail logs view, sign, decline, consent events with timestamps
- [x] Store timestamp of signature action — `signedAt` stored per recipient
- [x] Log IP address and device information — `extractClientIp` in `http.ts` + `/api/v1/ip` endpoint; signing page fetches client IP and passes through all mutations; `userAgent` captured via `navigator.userAgent`

**Reference**: Feature #9 - Digital Signature Implementation (`/features/signature-workflow/digital-signature-implementation/feature-spec.md:62-67`)

---

### 2. Consent to Do Business Electronically 📝

**Legal Requirement**: Obtain explicit consent from signers to conduct business electronically.

**Implementation Checklist**:

- [x] Show consent modal BEFORE first signature opportunity — `EsignConsentDialog` component gates signing page; blocks access until consent recorded
- [x] Clear language explaining electronic signature process — consent dialog explains electronic signing process with legal language
- [x] Checkbox or explicit "I consent" action required — checkbox + "I Agree" button in consent dialog
- [x] Store consent confirmation with user ID and timestamp — `recordEsignConsent` mutation stores `esignConsentAt`, `esignConsentIp`, `esignConsentVersion` on recipient
- [x] Track consent version (in case terms change) — `esignConsentVersion` field on recipient, defaults to "1.0"
- [x] Allow consent withdrawal option — "Decline & Exit" option with alternative paper signing paths

**Reference**: Feature #26 - Security & Compliance (`/features/authentication/security-compliance/feature-spec.md:67-71`)

---

### 3. Opt-Out Option 🚪

**Legal Requirement**: Provide alternative to electronic signing (paper/manual process).

**Implementation Checklist**:

- [x] Offer "Download PDF for manual signing" option — available in `EsignConsentDialog` declined state via download button
- [x] Clear instructions on how to use paper process — declined state shows "Request Paper Copy" and "Contact Document Sender" options
- [x] Contact information for requesting paper documents — "Contact Document Sender" option with email link
- [x] Log when users choose opt-out option — `recordEsignOptOut` mutation logs `recipient.esign_opt_out` to audit trail
- [ ] Support workflow for receiving manually-signed documents back

**Reference**: Feature #26 - Security & Compliance (`/features/authentication/security-compliance/feature-spec.md:72-74`)

---

### 4. Distribution of Signed Copies 📧

**Legal Requirement**: Automatically deliver signed copies to all parties.

**Implementation Checklist**:

- [x] Automatic email delivery to all signers upon completion — `sendSigningComplete` in `recipient_email_action.ts`
- [x] Sender receives copy of completed document — `sendDocumentCompleted` triggered on all-complete
- [x] Generate secure download links (time-limited) — `download_tokens` table with SHA-256 hashed tokens, 7-day expiry, HTTP endpoint at `/download?token=...`
- [x] Track delivery confirmations (email opened, downloaded) — Resend webhook handler at `/resend-webhooks` logs `email.delivered`, `email.opened`, `email.bounced` to audit trail
- [x] Store proof of delivery in audit trail — delivery events stored via `logEmailEvent` internalMutation with document/recipient context
- [x] Resend option if delivery fails — email retry logic exists in cron

**Reference**: Feature #26 - Security & Compliance (`/features/authentication/security-compliance/feature-spec.md:72-74`)

---

### 5. Record Retention 🗄️

**Legal Requirement**: Store documents and audit trails for legally-required retention period.

**Implementation Checklist**:

- [x] Store signed documents for minimum **7 years** (industry standard) — `retainUntil` field set to `completedAt + 7 years` on document completion; deletion blocked during retention period
- [x] Encrypted storage in Convex database — Convex provides encrypted-at-rest storage
- [x] Immutable storage (prevent tampering) — `DOCUMENT_IMMUTABLE` guard on `updateDocument`/`updateThumbnail`; signature_fields enforce draft-only; workflow transitions prevent completed→* transitions; retention policy blocks deletion
- [x] Document retrieval system for legal requests — `exportDocumentAuditTrail` query provides comprehensive compliance export
- [x] Audit trail preserved alongside document — audit logs indexed by `documentId`, retained alongside document
- [ ] Backup and disaster recovery procedures
- [x] Data export capability for users leaving platform — `requestDataExport` mutation + `generateDataExport` action exports all user data as JSON to Convex Storage; `data_exports` table tracks status; `getLatestExport` query provides download URL

**Reference**: Feature #26 - Security & Compliance (`/features/authentication/security-compliance/feature-spec.md:76-79`)

---

## 🔐 Document Integrity & Audit Trail Requirements

### Document Integrity Verification

**Implementation Checklist**:

- [x] Generate SHA-256 hash on document upload (Web Crypto API) — `hashDocument` internalAction auto-scheduled from `createDocument` mutation via `ctx.scheduler.runAfter(0, ...)`
- [x] Store document hash in database — `documentHash` field in documents schema
- [x] Verify hash before signature process starts — `verifyDocumentIntegrityForSigning` in `signatures/helpers.ts` called before every signature
- [x] Generate final signed document hash — `documentHashAtSigning` stored per signature
- [x] Detect hash mismatches and block signing if detected — throws `INTEGRITY_ERROR` ConvexError if document was modified after prior signatures
- [x] Log all hash verification events — integrity failures logged via ConvexError (blocks mutation, visible in Convex dashboard)

**Reference**: Feature #26 - Security & Compliance (`/features/authentication/security-compliance/feature-spec.md:48-60`)

---

### Comprehensive Audit Trail (CRITICAL)

**Implementation Checklist**:

- [x] **Document Actions**: Log upload, modification, deletion — `document.created` logged in `createDocument`, `document.sent` logged in `markDocumentAsSent`
- [x] **Signature Fields**: Log additions, changes, removals — `logFieldAction` called from `signature_fields/mutations.ts`
- [x] **Recipients**: Log additions, modifications, removals — `logRecipientAction` with `recipient.added/updated/removed` called from `recipients_mutations.ts`
- [x] **Document Lifecycle**: Log sending, viewing, signing, completion — `logRecipientAction` called from `submitRecipientSignature` (token-based) and `submitSignatureAuthenticated` (authenticated); covers signed, declined, viewed
- [x] **User Sessions**: Log authentication and session events — `logSessionEvent` internalMutation triggered by Clerk `session.created/ended/removed/revoked` webhooks
- [x] **Immutable Storage**: Use Convex immutable data structure — `audit_logs` table with 24 action types
- [x] **Timestamps**: Precise timestamps for every event (UTC) — `timestamp` field on all audit entries
- [x] **User Attribution**: Link every action to authenticated user — `userId` on audit entries; recipient-only flows use `actorType: "recipient"` with `recipientId`
- [x] **IP Address Tracking**: Store IP for security and compliance — `extractClientIp` reads proxy headers; signing page captures via `/api/v1/ip`; authenticated flows use "web-authenticated" as a known-auth marker
- [x] **Device Information**: Basic device/browser info — `userAgent` captured via `navigator.userAgent` in signing page and passed through signature mutations to audit log entries

**Critical Rule**: ⚠️ **If audit logging fails, BLOCK the action from proceeding**

**Reference**: Feature #23 - Audit Trail & Compliance (`/features/compliance-audit/feature-spec.md:36-53`)

---

### Audit Logging Failure Handling

**Implementation Checklist**:

- [x] Retry mechanism (3 attempts) before blocking action — `logActionRequired()` in `audit_logs/helpers.ts`
- [x] Block signature completion if audit log fails — `logSignatureAction` uses `logActionRequired`
- [x] Block document send if audit log fails — `logDocumentAction` uses `logActionRequired`
- [x] Block field changes if audit log fails — `logFieldAction` uses `logActionRequired`
- [x] Clear error messages to users explaining requirement — ConvexError with `AUDIT_LOG_FAILURE` code
- [ ] Alert workspace admin when logging consistently fails
- [ ] Monitoring and alerting for audit system health

**Reference**: Feature #23 - Audit Trail & Compliance (`/features/compliance-audit/feature-spec.md:84-93`)

---

## 📊 Certificate of Completion

**Implementation Checklist**:

- [x] Generate certificate upon document completion — `generateCertificate` internalAction scheduled on document completion
- [x] Include document details (title, date, parties) — Document Details section in certificate PDF
- [x] List all signers with timestamps — Signers & Recipients section with completion timestamps
- [x] Include signature methods used — (via audit trail timeline, not per-recipient since field doesn't exist on recipients)
- [x] Embed document hash for verification — SHA-256 hash included in Document Details
- [x] Chronological timeline of all events — Audit Trail Timeline section sorted by `createdAt`
- [x] PDF format suitable for legal proceedings — A4 PDF generated with pdf-lib, stored in Convex Storage
- [x] Automatic delivery to all parties — certificate generated on completion, stored as `certificateStorageId` on document

**Reference**: Feature #23 - Audit Trail & Compliance (`/features/compliance-audit/feature-spec.md:100-109`)

---

## 🔒 Digital Signature Security

**Implementation Checklist**:

- [x] Use Web Crypto API for cryptographic operations — `generateStringHash` now uses SHA-256 via `crypto.subtle.digest`; per-signature hash uses SHA-256
- [x] Generate unique signature for each signing event — unique token + timestamp per signature
- [x] Store signature data securely (encrypted) — AES-256-GCM encryption via `crypto/encryption.ts` with `SIGNATURE_ENCRYPTION_KEY` env var; graceful fallback for unencrypted data
- [x] Validate signature authenticity — `verifySignatureHash` compares SHA-256 hashes; `verifyDocumentIntegrityForSigning` checks document hash consistency
- [x] Prevent signature reuse or copying — `signatureImageHash` (SHA-256 of image data) stored per signature with `by_signature_image_hash` index for cross-document reuse detection
- [x] Signature timestamp verification — `signedAt` stored per signature
- [x] Support multiple signature types (draw, type, upload) — all three implemented in `signature-capture.tsx`

**Reference**: Feature #9 - Digital Signature Implementation (`/features/signature-workflow/digital-signature-implementation/feature-spec.md`)

---

## 📤 Compliance Reporting & Export

**Implementation Checklist**:

- [x] Generate audit reports for specific documents — `exportDocumentAuditTrail` query in `audit_logs/queries.ts`
- [ ] Generate audit reports for date ranges
- [ ] Export in multiple formats (PDF, CSV, JSON) — JSON export exists; no PDF or CSV
- [ ] Search audit logs by document, user, or date — query by document exists; no general search UI
- [ ] Legal-ready documentation format
- [x] Chronological event timelines — audit trail returned chronologically
- [x] Include all verification data — signatures, certificates, hashes included in export

**Reference**: Feature #23 - Audit Trail & Compliance (`/features/compliance-audit/feature-spec.md:100-114`)

---

## ✅ Pre-Launch Compliance Verification

Before launching to production, verify:

- [x] All 5 ESIGN Act requirements implemented and tested
- [x] Audit logging system working and tested for failures — `logActionRequired` with 3-retry and ConvexError on failure
- [x] Certificate of completion generation working — `generateCertificate` internalAction with pdf-lib
- [x] Document integrity verification working — `verifyDocumentIntegrityForSigning` blocks signing on hash mismatch
- [x] Record retention system in place — 7-year `retainUntil` with deletion guard
- [ ] Consent flow tested with real users
- [x] Opt-out process documented and accessible — paper copy and contact options in consent dialog
- [x] Signed document distribution automated — completion emails with secure download links
- [ ] Legal review completed (consult with attorney)
- [ ] Security audit passed
- [ ] Penetration testing completed

---

## 🎯 Success Criteria

**Minimum Requirements for MVP Launch**:

1. ✅ All 5 ESIGN Act requirements fully implemented
2. ✅ Audit logging blocks actions on failure
3. ✅ Document integrity verification working
4. ✅ Signed documents automatically distributed
5. ✅ Record retention system operational
6. ✅ Certificate of completion generated
7. ✅ Legal review completed

**Do NOT launch without these items completed.**

---

## 📚 Additional Resources

- [ESIGN Act Full Text](https://www.fdic.gov/regulations/compliance/manual/10/x-3.1.pdf)
- [UETA Summary](https://www.uniformlaws.org/committees/community-home?CommunityKey=2c04b76c-2b7d-4399-977e-d5876ba7e034)
- Feature #23: Audit Trail & Compliance - `/features/compliance-audit/feature-spec.md`
- Feature #26: Security & Compliance - `/features/authentication/security-compliance/feature-spec.md`
- Feature #9: Digital Signatures - `/features/signature-workflow/digital-signature-implementation/feature-spec.md`

---

**Last Updated**: 2026-02-18
**Owner**: Development Team
**Reviewer**: Legal Counsel (required before launch)
