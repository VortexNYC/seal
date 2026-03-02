# Feature Execution Plan — Documenso Competitive Gap Closure

> **Status:** IN PROGRESS
> **Created:** 2026-02-25
> **Last updated:** 2026-03-02
> **Source:** Documenso competitive analysis → 13 design documents

## Strategy

4-wave execution based on dependency analysis. Waves 1-2 are sequential (each feature builds on the previous). Wave 3 is fully parallelizable. Wave 4 depends on everything else being done.

---

## Wave 1: Foundation

These unblock everything else. Build first.

| # | Feature | Design Doc | Status |
|---|---------|-----------|--------|
| 1 | Org Settings Inheritance | `2026-02-25-org-settings-inheritance-design.md` | DONE |
| 2 | Folders | `2026-02-25-folders-design.md` | DONE |

**Why first:** Org Settings provides the settings infrastructure consumed by 6+ other features. Folders touches documents/templates schemas early so later features build on top.

---

## Wave 2: Document Lifecycle

Signing page + document schema core. Sequential — each depends on the previous.

| # | Feature | Design Doc | Status |
|---|---------|-----------|--------|
| 3 | Document Expiration | `2026-02-25-document-expiration-design.md` | DONE |
| 4 | Custom Redirect | `2026-02-25-custom-redirect-design.md` | DONE |
| 5 | Dictate Next Signer | `2026-02-25-dictate-next-signer-design.md` | DONE |
| 6 | Assistant Recipient Role | `2026-02-25-assistant-recipient-role-design.md` | NOT STARTED |

**Why this order:** Document Expiration defines the signing page interaction order that features 4-6 follow. It also adds the `"expired"` workflow status that other features must handle. Custom Redirect is small and depends on that interaction order. Dictation and Assistant both touch the signing page and recipients schema.

---

## Wave 3: Platform Features (Parallelizable)

All 5 features are independent — zero file conflicts. Can run as parallel worktrees.

| # | Feature | Design Doc | Status |
|---|---------|-----------|--------|
| 7 | QR Code Certificate | `2026-02-25-qr-code-certificate-design.md` | NOT STARTED |
| 8 | Direct Link Templates | `2026-02-25-direct-link-templates-design.md` | NOT STARTED |
| 9 | Delegate Ownership | `2026-02-25-delegate-ownership-design.md` | NOT STARTED |
| 10 | Custom Email Domain | `2026-02-25-custom-email-domain-design.md` | NOT STARTED |
| 11 | User Security Audit Logs | `2026-02-25-audit-logs-design.md` | NOT STARTED |

**Why parallel:** Each feature has its own schema, its own backend module, its own frontend route. No shared hot files.

---

## Wave 4: External Integrations (Last)

Depend on all other features being in place.

| # | Feature | Design Doc | Status |
|---|---------|-----------|--------|
| 12 | OpenAPI Spec & SDK | `2026-02-25-openapi-spec-design.md` | NOT STARTED |
| 13 | Zapier Integration | `2026-02-25-zapier-integration-design.md` | NOT STARTED |

**Why last:** OpenAPI needs all API endpoints finalized. Zapier needs webhook events from other features to exist.

---

## Hot Files (Conflict Risk)

These files are touched by multiple features. Wave ordering prevents conflicts:

| File | Features That Touch It |
|------|----------------------|
| `schemas/documents.ts` | Expiration, Redirect, Dictation, QR Code, Folders |
| `schemas/recipients.ts` | Expiration, Dictation, Assistant |
| `sign.$token.tsx` | Expiration, Redirect, Dictation, Assistant |
| `document-settings-panel.tsx` | Expiration, Redirect, Dictation |
| `crons.ts` | Expiration, Email Domain, Audit Logs |
| `schemas/audit_logs.ts` | Expiration, Dictation, Delegate, Assistant |
| `schema.ts` | Folders, Email Domain, Audit Logs, Zapier |

---

## Cross-Cutting Decisions (Resolved)

1. **Documents schema**: Keep fields flat (no sub-object). Convex handles sparse optional fields well.
2. **Signing page interaction order**: Expiration → Auth → Signing → Dictation → Redirect
3. **Dictation token**: Keep token valid, gate by recipient status (no second token type).
4. **Direct link staleness**: Use `structureUpdatedAt` field, only structural changes invalidate.
5. **Org settings consumption**: Always use `getOrgSettings` query, never read `org.settings` directly.
6. **Zapier subscriptions**: Separate `zapier_subscriptions` table, not overloading `webhooks`.
7. **Reminder schedule**: `v.array(v.number())` not comma-separated string.
8. **Auth methods**: Only `"email"` for v1, don't add `"sms"`/`"id_verification"` to schema until built.
9. **Custom email domain**: Resend handles everything. No AWS SES, no key management.
10. **QR verification**: Simple public query with token lookup. Clerk adds no value here.
