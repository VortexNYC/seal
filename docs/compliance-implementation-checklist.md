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
- [ ] Capture user interaction data during signing process
- [x] Store timestamp of signature action — `signedAt` stored per recipient
- [ ] Log IP address and device information — **IP hardcoded as "0.0.0.0"** in `sign.$token.tsx:406`

**Reference**: Feature #9 - Digital Signature Implementation (`/features/signature-workflow/digital-signature-implementation/feature-spec.md:62-67`)

---

### 2. Consent to Do Business Electronically 📝

**Legal Requirement**: Obtain explicit consent from signers to conduct business electronically.

**Implementation Checklist**:

- [ ] Show consent modal BEFORE first signature opportunity
- [ ] Clear language explaining electronic signature process
- [ ] Checkbox or explicit "I consent" action required
- [ ] Store consent confirmation with user ID and timestamp
- [ ] Track consent version (in case terms change)
- [ ] Allow consent withdrawal option

**Reference**: Feature #26 - Security & Compliance (`/features/authentication/security-compliance/feature-spec.md:67-71`)

---

### 3. Opt-Out Option 🚪

**Legal Requirement**: Provide alternative to electronic signing (paper/manual process).

**Implementation Checklist**:

- [ ] Offer "Download PDF for manual signing" option
- [ ] Clear instructions on how to use paper process
- [ ] Contact information for requesting paper documents
- [ ] Log when users choose opt-out option
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

- [ ] Generate SHA-256 hash on document upload (Web Crypto API) — `hashDocument` action exists with real SHA-256 (`crypto/node_helpers.ts`) but **never called at upload time**
- [x] Store document hash in database — `documentHash` field in documents schema
- [ ] Verify hash before signature process starts — not implemented
- [x] Generate final signed document hash — `documentHashAtSigning` stored per signature
- [ ] Detect hash mismatches and block signing if detected — not implemented
- [ ] Log all hash verification events

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
- [ ] **IP Address Tracking**: Store IP for security and compliance — schema has `ipAddress` field but hardcoded as "0.0.0.0" or "web-authenticated"
- [ ] **Device Information**: Basic device/browser info — user agent captured in signatures but not in audit logs

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

- [ ] Use Web Crypto API for cryptographic operations — SHA-256 exists for document hash (`crypto/node_helpers.ts`); **per-signature hash uses weak non-cryptographic rolling hash** (`crypto/helpers.ts:generateStringHash`)
- [x] Generate unique signature for each signing event — unique token + timestamp per signature
- [ ] Store signature data securely (encrypted) — signature data stored as base64 data URL, not encrypted
- [ ] Validate signature authenticity — `generateSignatureCertificate` checks `integrityVerified` but relies on weak hash
- [ ] Prevent signature reuse or copying — not implemented
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

- [ ] All 5 ESIGN Act requirements implemented and tested
- [ ] Audit logging system working and tested for failures
- [ ] Certificate of completion generation working
- [ ] Document integrity verification working
- [ ] Record retention system in place
- [ ] Consent flow tested with real users
- [ ] Opt-out process documented and accessible
- [ ] Signed document distribution automated
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

**Last Updated**: 2026-02-17
**Owner**: Development Team
**Reviewer**: Legal Counsel (required before launch)
