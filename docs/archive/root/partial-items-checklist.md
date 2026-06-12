# Partial Items Checklist

**Purpose**: Track all incomplete work items discovered during the 2026-02-18 codebase audit. Each item traces back to its source requirement so you can dive deeper when needed.

**Last Audited**: 2026-02-18

---

## Where We Left Off (2026-02-18 session)

**Branch**: `feature/payment-field-builder`

**Last completed work**: Full compliance & security sprint — 9 structured commits pushed covering schemas, crypto (SHA-256 + AES-256-GCM), audit trail hardening, webhook delivery system, document compliance (ESIGN consent, retention, certificates, download tokens), email actions + API wiring, signatures + recipient mutations, frontend improvements (analytics dashboard, ESIGN consent dialog, advanced field types), and CI/CD + docs.

**Next up**: Mobile optimization (#13). We did a full audit of mobile readiness and found:

- **Signing page (recipient side)**: Already mobile-ready (responsive layout, touch signature capture, safe-area padding)
- **Document editor (sender side)**: NOT mobile-ready — field placement uses HTML5 Drag & Drop which doesn't work on touch devices

**Agreed plan for mobile fixes** (in priority order):

1. **Tap-to-place fields** (HIGH) — Tap a field type in toolbar → tap on canvas to place it. Sidesteps HTML5 DnD limitation entirely.
2. **Bottom sheet for field toolbar on mobile** (MEDIUM) — Replace sidebar toolbar with a bottom sheet on small screens so users don't have to scroll past the document.
3. **Larger Konva transform handles on touch** (LOW) — Make resize handles bigger for finger targets.
4. **Touch-drag for placed fields** (LOW) — Already works via Konva's built-in touch support.

**Files to modify**:

- `apps/web/src/components/documents/field-toolbar.tsx` — Add tap-to-select mode alongside drag
- `apps/web/src/components/documents/pdf-canvas-layer.tsx` — Add tap-to-place handler on canvas
- `apps/web/src/routes/_authenticated/$slug/documents/$documentId.tsx` — Wire up tap-to-place state, add mobile bottom sheet
- `apps/web/src/components/documents/draggable-field.tsx` — Larger transform handles on touch

---

## How to Use

- Items are grouped by roadmap deliverable
- Each item has a `Source` linking to the doc + section where the requirement lives
- Check items off as they're completed
- Items marked `[BLOCKER]` must be done before launch

---

## #9 Signature Capture — Crypto Gaps

> Roadmap #9 says "Web Crypto API for digital signatures (document hashing, certificates)"

- [x] ~~**[BLOCKER]** Call SHA-256 `hashDocument` action at document upload time~~ — Done: wired into upload mutation
- [x] ~~**[BLOCKER]** Verify document hash before signature process starts~~ — Done: `verifyDocumentIntegrityForSigning` added to all 3 signature mutations
- [x] ~~**[BLOCKER]** Detect hash mismatches and block signing if detected~~ — Done: throws `INTEGRITY_ERROR` ConvexError on mismatch
- [x] ~~**[BLOCKER]** Replace weak per-signature hash (djb2 rolling hash) with SHA-256~~ — Done: `generateSignatureHash` now uses SHA-256 via Web Crypto
- [x] ~~Prevent signature reuse or copying~~ — Done: `signatureImageHash` (SHA-256 of image data) stored per signature with `by_signature_image_hash` index for cross-document reuse detection; `generateSignatureHash` already binds each signature to recipientId + fieldId + documentHash + timestamp
  - Source: `compliance-implementation-checklist.md` → "Digital Signature Security" → fifth checkbox
- [x] ~~Encrypt stored signature data (currently base64 data URL, not encrypted)~~ — Done: AES-256-GCM encryption via `crypto/encryption.ts` with `SIGNATURE_ENCRYPTION_KEY` env var; graceful fallback for unencrypted data (backward compat)
  - Source: `compliance-implementation-checklist.md` → "Digital Signature Security" → third checkbox

---

## #13 Mobile Optimization

> Roadmap says "All pages responsive (320px to 1920px)" and "Mobile-friendly signature canvas (touch optimized)"

- [ ] Touch-optimize document editor canvas (pinch-to-zoom, touch drag for fields)
  - Source: `development-roadmap.md` → #13: "document editor canvas not touch-optimized"
  - Source: `design-phase/ui-specifications/responsive-breakpoints.md`
  - Source: `features/signature-workflow/signing-experience/wireframes/02-mobile-signature-capture.md`
- [x] Remove debug markers from `pdf-canvas-layer.tsx`
  - Source: Audit finding — debug artifacts still in production code
  - Code: `apps/web/src/components/documents/pdf-canvas-layer.tsx`
- [x] Fix `safe-area-inset-bottom` CSS class (used but has no definition)
  - Source: Audit finding — class referenced but no corresponding CSS
- [ ] Test complete workflow on iOS Safari and Android Chrome
  - Source: `development-roadmap.md` → #13: "Test on iOS and Android browsers"
- [ ] Bundle size optimization
  - Source: `development-roadmap.md` → #13 bullet list
- [ ] Optimize performance for slower connections
  - Source: `development-roadmap.md` → #13 bullet list

---

## #14 Notifications & Onboarding

> Roadmap says "Welcome tour / guided walkthrough" and "Quick-start checklist for new users"

### Notifications (done)

- [x] Enforce notification preferences at write time (preferences stored but not checked before creating notifications)
  - Source: Audit finding — `notification_preferences` table populated, never queried on write path
  - Code: Check notification creation mutations in `apps/backend/convex/notifications/`

### Onboarding (not started)

- [ ] Welcome tour / guided walkthrough for new users
  - Source: `development-roadmap.md` → #14: "Welcome tour / guided walkthrough"
  - Source: `features/workspace-management/landing-onboarding/wireframes/02-onboarding-flow.md`
- [ ] Quick-start checklist for new users
  - Source: `development-roadmap.md` → #14: "Quick-start checklist for new users"
  - Source: `features/workspace-management/landing-onboarding/wireframes/03-interactive-demo.md`
- [ ] Sample documents/templates for new workspaces
  - Source: `development-roadmap.md` → #14: "Sample documents/templates"
- [ ] Contextual help tooltips
  - Source: `development-roadmap.md` → #14: "Contextual help tooltips"

---

## #15 Public REST API — Minor Gaps

> Roadmap says "Full v1 endpoints" — mostly done, 3 endpoints missing email triggers

- [x] ~~Add email triggers to API endpoints with TODO comments~~ — Done: `sendDocument` schedules `sendDocumentEmailsInternal`, `voidDocument` schedules `sendCancellationEmails`, `sendReminder` schedules `sendReminderEmailDirect`
  - Source: `development-roadmap.md` → #15: "3 API endpoints missing email triggers (TODO comments)"

---

## #16 Webhooks System

> Roadmap says "Webhook delivery queue with retry logic (exponential backoff)" and "Webhook signature verification"

- [x] ~~**[BLOCKER]** Implement HTTP delivery action that POSTs to registered webhook URLs~~ — Done: `webhooks/delivery.ts` with `processWebhookDeliveries` internalAction
- [x] ~~**[BLOCKER]** Implement HMAC-SHA256 request signing for webhook payloads~~ — Done: `signPayload()` generates `v1=<hmac-hex>` signatures using Web Crypto
- [x] ~~**[BLOCKER]** Implement retry logic with exponential backoff~~ — Done: 5 attempts with 30s/2m/10m/30m/2h intervals, auto-disable after 10 consecutive failures
- [x] ~~**[BLOCKER]** Publish webhook events from mutations~~ — Done: `publishWebhookEvent` helper wired into document.sent, document.completed, document.voided, recipient.signed, recipient.declined
- [x] ~~Redesign secret storage~~ — Done: added raw `secret` field to `webhook_endpoints` schema alongside `secretHash`
- [x] ~~Webhook delivery logs UI~~ — Done: expandable delivery rows showing payload, response body, error messages, attempt count, event ID, timestamps; 25 recent deliveries per endpoint
  - Source: `development-roadmap.md` → #16: "Webhook delivery logs"

---

## #17 Testing

> Roadmap says ">80% coverage" and lists integration + E2E + performance testing

### Coverage

- [ ] Configure coverage reporting (Vitest `--coverage`)
  - Source: `development-roadmap.md` → #17: "coverage unknown"
  - Source: `docusign-oss-vision.md` (lines 109-113)

### Missing Unit/Integration Tests

- [ ] Core document mutations (CRUD, state transitions)
  - Source: `development-roadmap.md` → #17 integration test list
- [ ] REST API handler tests
  - Source: `development-roadmap.md` → #17: "API endpoints"
- [ ] Auth guard tests (`ensureOwner`, `ensureAdmin`, `ensurePermission`, etc.)
  - Source: Audit finding — guards in `auth/guards.ts` have zero tests
- [ ] PDF pipeline tests (upload → hash → embed signatures → generate signed PDF)
  - Source: Audit finding — `crypto/`, `pdf/` directories untested
- [ ] Email action tests
  - Source: Audit finding — `recipient_email_action.ts` untested

### Missing E2E Tests

- [ ] Complete signing flow E2E (upload → send → sign → complete)
  - Source: `development-roadmap.md` → #17: "Sign document as recipient"
  - Note: 45 E2E tests currently skipped
- [ ] Subscription management E2E
  - Source: `development-roadmap.md` → #17: "Manage subscription"

### Performance Testing

- [ ] Page load time benchmarks (<2s)
  - Source: `development-roadmap.md` → #17: "Page load times <2s"
  - Source: `mvp-gameplan-structure.md` (lines 107-118)
- [ ] Large PDF handling (50+ pages)
  - Source: `development-roadmap.md` → #17: "Large PDF handling"
- [ ] Load testing with 100 concurrent users
  - Source: `development-roadmap.md` → #17: "Load testing with 100 concurrent users"

---

## #18 Security & Compliance

> Roadmap says "ESIGN Act compliance verification" — see also `compliance-implementation-checklist.md`

### ESIGN Act (5 requirements)

#### 1. Intent to Sign

- [x] Clear "Accept & Sign" button with legal disclaimer
- [x] Signature method recorded (draw/type/upload)
- [x] Timestamp stored per signature
- [x] ~~**[BLOCKER]** Capture real IP address~~ — Done: IP captured via external API in signing page, passed through mutations
- [x] ~~Capture device/user-agent information in audit logs~~ — Done: `userAgent` field in audit_logs schema, passed through all signature mutations from `navigator.userAgent`, stored in audit log entries
  - Source: `compliance-implementation-checklist.md` → "Audit Trail" → "Device Information" checkbox

#### 2. Consent to Do Business Electronically

- [x] ~~**[BLOCKER]** Show consent modal BEFORE first signature opportunity~~ — Done: `EsignConsentDialog` gates signing page
- [x] ~~**[BLOCKER]** Store consent confirmation with user ID, timestamp, and version~~ — Done: `recordEsignConsent` mutation stores timestamp, IP, consentVersion
- [x] ~~**[BLOCKER]** Allow consent withdrawal option~~ — Done: "Decline & Exit" with alternative options

#### 3. Opt-Out Option

- [x] ~~Offer "Download PDF for manual signing" option~~ — Done: in EsignConsentDialog declined state
- [x] ~~Instructions for paper signing process~~ — Done: "Request Paper Copy" and "Contact Document Sender" options
- [x] ~~Log when users choose opt-out~~ — Done: `recordEsignOptOut` mutation with audit trail

#### 4. Distribution of Signed Copies

- [x] Automatic email to all signers on completion
- [x] Sender receives completed document
- [x] Generate time-limited secure download links
  - Source: `compliance-implementation-checklist.md` → "Distribution" → third checkbox
- [x] Track delivery confirmations (email opened, downloaded)
  - Source: `compliance-implementation-checklist.md` → "Distribution" → fourth checkbox
- [x] Store proof of delivery in audit trail
  - Source: `compliance-implementation-checklist.md` → "Distribution" → fifth checkbox

#### 5. Record Retention

- [x] Define and enforce 7-year retention policy
  - Source: `compliance-implementation-checklist.md` → "Record Retention" → all 7 checkboxes
- [x] ~~Immutable storage (prevent tampering after signing)~~ — Done: `DOCUMENT_IMMUTABLE` guard added to `updateDocument` and `updateThumbnail` mutations; signature_fields already enforce `verifyDocumentIsDraft`; workflow mutations have status-based transition guards; retention policy prevents deletion
- [x] ~~Data export capability for users leaving platform~~ — Done: `user_data_export.ts` with `requestDataExport` mutation, `generateDataExport` action, `gatherUserData` query; exports user profile, documents, memberships, signatures, notifications, audit trail, subscription, shared documents as JSON to Convex Storage; `data_exports` table tracks status; `getLatestExport` query provides download URL

### Audit Trail Gaps

- [x] ~~Log recipient additions/modifications/removals~~ — Done: `logRecipientAction` calls added to `addRecipients`, `removeRecipient`, `updateRecipient` in `recipients_mutations.ts`; `logRecipientAction` action type widened to include `recipient.added/updated/removed`
  - Source: `compliance-implementation-checklist.md` → "Comprehensive Audit Trail" → "Recipients" checkbox
- [x] Log user session/authentication events
  - Source: `compliance-implementation-checklist.md` → "Comprehensive Audit Trail" → "User Sessions" checkbox
- [x] Implement audit logging failure handling (retry 3x, then block action)
  - Source: `compliance-implementation-checklist.md` → "Audit Logging Failure Handling" → all 7 checkboxes

### Certificate of Completion

- [x] Generate PDF certificate on document completion
  - Source: `compliance-implementation-checklist.md` → "Certificate of Completion" → all 8 checkboxes
  - Source: `features/compliance-audit/feature-spec.md:100-109`
- [x] Include: document details, all signers + timestamps, signature methods, document hash, chronological timeline

### Other Security Items

- [x] ~~**[BLOCKER]** Hash/salt recipient tokens (currently plaintext)~~ — Done: SHA-256 hashed tokens with `by_token_hash` index
- [ ] Security scanning (npm audit, Snyk)
  - Source: `development-roadmap.md` → #18 bullet list
- [ ] Auth vulnerability testing (CSRF, XSS)
  - Source: `development-roadmap.md` → #18 bullet list

---

## #19 Production Deployment

> Roadmap says "Production smoke tests passing"

- [x] ~~**[BLOCKER]** Set up CI/CD pipeline (GitHub Actions)~~ — Done: `.github/workflows/ci.yml` with lint, format, typecheck, and build jobs
- [x] ~~Add security headers (CSP, HSTS, X-Frame-Options, etc.)~~ — Done: `apps/web/vercel.json` now includes X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, HSTS, Permissions-Policy, X-DNS-Prefetch-Control
  - Source: Audit finding — Vercel config has no headers
  - Source: `development-roadmap.md` → #18: "Auth vulnerability testing"
- [ ] Create production smoke tests
  - Source: `development-roadmap.md` → #19: "Production smoke tests passing"
- [ ] Configure production environment variables documentation
  - Source: `development-roadmap.md` → #19: "Production environment variables configured"

---

## #20 Launch Prep

> Roadmap says "Demo videos, User documentation, Developer documentation, GitHub open-source prep"

- [x] Marketing landing page (apps/landing — done 2026-02-18)
- [x] Developer documentation site (Fumadocs migrated to landing — done 2026-02-18)
- [ ] Demo videos
  - Source: `development-roadmap.md` → #20: "Demo videos"
- [ ] User documentation (non-developer guides)
  - Source: `development-roadmap.md` → #20: "User documentation"
- [ ] GitHub repository prepared for open source
  - Source: `development-roadmap.md` → #20: "GitHub repository prepared for open source"
  - Source: `docusign-oss-vision.md` (lines 191-195 — Community Strategy)
- [ ] Launch announcements drafted
  - Source: `development-roadmap.md` → #20: "Product Hunt, HackerNews, Twitter"

---

## Additional: Advanced Field Types

> Roadmap additional table says "Checkbox multi-option fill: missing. File upload: base64 stub"

- [x] ~~Checkbox field: multi-option rendering in signing view~~ — Done: `CheckboxFieldInput` now renders multi-option checkboxes when `options` are configured; `field-input-manager.tsx` passes `options` to the component; stores selected options as JSON array
  - Source: `development-roadmap.md` → Additional Work table
  - Source: `CLAUDE.md` → Known Issues #10
- [x] ~~Attachment/file upload field: replace base64 stub with Convex Storage~~ — Done: `AttachmentFieldInput` now uploads to Convex Storage via `generateAttachmentUploadUrl` mutation (token-authenticated); stores `storageId` instead of base64
  - Source: `development-roadmap.md` → Additional Work table
  - Source: `CLAUDE.md` → Known Issues #11
- [x] ~~Add attachment field to editor toolbar (currently missing from toolbar)~~ — Done: `PaperclipIcon` attachment `FieldButton` added to `field-toolbar.tsx`
  - Source: Audit finding — field type exists but not exposed in toolbar
- [x] ~~Payment field: enforce payment completion as prerequisite to signing~~ — Done: both `submitRecipientSignature` and `submitSignatureAuthenticated` now check `paymentStatus !== "paid"` and throw `PAYMENT_REQUIRED` error; frontend disables Sign button and shows warning when payments are unpaid
  - Source: Audit finding — payment field works but signer can skip paying and still sign

---

## Additional: Document Sharing — 9 Remaining Items

> See `IMPROVEMENT_PLAN_SHARED_DOCUMENTS.md` for the full list

- [ ] Review and address 9 items from `IMPROVEMENT_PLAN_SHARED_DOCUMENTS.md`
  - Source: `development-roadmap.md` → Additional Work table: "See IMPROVEMENT_PLAN_SHARED_DOCUMENTS.md for 9 remaining items"

---

## Additional: Analytics Stub

> Roadmap #12 notes say "/analytics route is a stub"

- [x] Implement `/analytics` route with real data
  - Source: `development-roadmap.md` → #12 notes: "`/analytics` route is a stub"

---

## Summary Stats

_Updated: 2026-02-18_

| Category                         | Total Items | Done   | Blockers Left |
| -------------------------------- | ----------- | ------ | ------------- |
| Crypto / Signatures (#9)         | 6           | 6      | 0             |
| Mobile (#13)                     | 6           | 2      | 0             |
| Notifications & Onboarding (#14) | 5           | 1      | 0             |
| REST API (#15)                   | 1           | 1      | 0             |
| Webhooks (#16)                   | 6           | 6      | 0             |
| Testing (#17)                    | 10          | 0      | 0             |
| Security & Compliance (#18)      | 28          | 26     | 0             |
| Production Deployment (#19)      | 5           | 3      | 0             |
| Launch Prep (#20)                | 6           | 2      | 0             |
| Advanced Field Types             | 4           | 4      | 0             |
| Other (sharing, analytics)       | 2           | 1      | 0             |
| **Total**                        | **79**      | **52** | **0**         |

**All 16 blockers resolved.**

---

_Generated from codebase audit on 2026-02-18. Cross-referenced against `development-roadmap.md`, `compliance-implementation-checklist.md`, `CLAUDE.md` Known Issues, and `future-work.md`._
