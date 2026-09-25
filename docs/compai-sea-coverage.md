# CompAI ↔ SEA coverage matrix

Source of truth for which CompAI findings Seal eng owns vs parks.
Updated with SEA-50 (Certificate of Completion / EVID-2).

| SEA | CompAI | Severity | Status | What “covered” means |
| --- | --- | --- | --- | --- |
| SEA-44 | `fnd_6ab563f5425574f54ad441c6` (soc2) | high | **done** | Tamper-evident `audit_logs` (hash chain / signed digests) |
| SEA-45 | `fnd_6ab563f55921f68ef33f6b75` (soc2) | high | **done** | Demonstrable ESIGN consent proof |
| SEA-46 | `fnd_6ab57f79acd3bc77c4cbdd55` + siblings | medium | backlog | Audit lifecycle + trusted timestamp + a11y |
| SEA-47 | `fnd_6ab57f78989e02663a3ad7ff` (EIDAS-1) | medium | backlog | Document eIDAS level + AES/QES path (docs, not product) |
| SEA-48 | `fnd_6ab57f78271c3d6767ba069b` (AUTH-1) | medium | **done** | Graded signer auth: `none` \| `access_code` \| `email_otp` |
| SEA-49 | `fnd_6ab57f7839041b4a5b9319ae` (EVID-4) | high | backlog | Cryptographic seal of final PDF bytes (PAdES-class) — **not** CoC |
| SEA-50 | `fnd_6ab57f78da8f9cbcb8affce0` (EVID-2) | high | **done** | Certificate of Completion PDF per completed envelope |
| SEA-51 | `fnd_6ab57d53603ca70a50b0c160` (hipaa) | medium | backlog | HIPAA / BAA scoping for health-doc signing |
| SEA-52 | `fnd_6ab57d53cb550d31b62425d7` + `fnd_6ab57d541b22e8a67eda3def` | high | backlog | Signer privacy notice + CCPA disclosures |
| SEA-53 | `fnd_6ab563f6cb3383f010948219` (soc2) | medium | backlog | Secret scanning in CI |
| SEA-54 | `fnd_6ab563f60a74553c6d277135` (soc2) | medium | backlog | External security audit / pen test |
| SEA-55 | `fnd_6ab563f6c6010aa7fade2e30` (soc2) | high | backlog | Backup/DR for signed docs + audit |
| SEA-56 | `fnd_6ab563f69ddf3aae4a95e3ae` (soc2) | high | **in progress → this PR** | Alert on audit-log write failures |
| SEA-57 | `fnd_6ab563f53c4f6314a654ecd3` (soc2) | high | backlog | Legal review of consent / retention / attribution |
| SEA-58 | `fnd_6ab563f5d67363c2a3e06fb8` (soc2) | high | backlog | ESIGN opt-out / manual-signature path |

Adjacent (not CompAI findings, but trust spine):

| SEA | Status | Notes |
| --- | --- | --- |
| SEA-63 | **done** | Atomic sign + first-writer-wins + audited expiry |
| SEA-59 | **done** | Seal-only Vortex signing path (ADR-005) |

## SEA-50 / EVID-2 acceptance

CompAI EVID-2 asks for a per-envelope evidentiary PDF with:

- parties (name + email)
- IPs where captured
- per-event timestamps
- document reference
- downloadable alongside the signed doc

Seal coverage in this change:

| Requirement | Where |
| --- | --- |
| Generate on `document.completed` | `apps/api/src/api/public.ts`, `apps/api/src/api/documents.ts` |
| PDF artifact (parties, IPs, auth, events, hash, verify URL) | `apps/api/src/platform/certificate-of-completion.ts` |
| R2 store `certificates/{org}/{doc}.pdf` | `apps/api/src/platform/certificate-store.ts` |
| Public download (token holder) | `GET /api/public/signing/{token}/certificate` |
| Org/API/MCP download | `GET /api/v1/documents/certificate?id=` |
| OpenAPI | `apps/docs/openapi.yaml` → `downloadCertificateOfCompletion` |
| Verify URL on certificate | `{APP_URL}/verify/{qrToken}` (existing route) |

**Explicit non-coverage:** SEA-49 (EVID-4 cryptographic PDF seal). The certificate footer states it is an audit summary, not a PAdES seal.

## SEA-44 / Audit hash chain

| Requirement | Where |
| --- | --- |
| Per-org tip + sealed rows (`prev_hash`, `entry_hash`, `sequence`) | migration `0036_audit_hash_chain.sql`, `audit_chain_tips` |
| Hash = SHA-256(prev \|\| canonical row) | `apps/api/src/platform/audit-chain.ts` |
| All writers seal via tip optimistic lock | `writeAuditLog`, `commitSigningSubmit`, `commitDocumentExpiry` |
| Verify unbroken sealed chain | `GET /api/v1/organizations/{slug}/audit/verify` |
| Legacy null-hash rows skipped | `verifyAuditChain` |

## SEA-56 / Audit write-failure alerts

| Requirement | Where |
| --- | --- |
| Count consecutive sealed-write failures | `audit_health` + `recordAuditWriteFailure` |
| Clear counter on successful write | `recordAuditWriteSuccess` |
| Alert workspace owners/admins after 3 failures | scheduled `runAuditHealthAlerts` (24h cooldown) |
| Email template | `AuditWriteFailureAlert` |

## SEA-45 / ESIGN consent

| Requirement | Where |
| --- | --- |
| Consent text published on signing session | `GET /signing/{token}` → `signingSettings.esignConsentText` |
| Record IP + UA + text hash | `POST /signing/{token}/consent` |
| Gate viewed/signed/approved until consented | `POST /signing/{token}/submit` → 403 |
| Audit + activity | `recipient.esign_consent` |
| CoC surfaces consent | Certificate party line |

