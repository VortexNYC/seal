# Enterprise / regulated readiness — Seal foundation backlog

Working notes after SEA-51 HIPAA scoping. CompAI findings on *other* Vortex
products (Pile enterprise table, Vortex privacy cluster) are **reference only** —
patterns to steal, not a joint-customer roadmap.

**Product frame (founder):** Seal must stand alone as a DocuSign-class replacement
with the compliance surfaces buyers need. Pile must stand alone vs Linear/Jira.
Customers are **not** assumed to buy both. Learn from each other’s CompAI lists;
do not design Seal features “so Pile users also have SSO.”

**Not waiting on VOR-571.**

## Plain-English posture

- Seal is a general e-sign platform. We do **not** claim HIPAA compliance or sell
  patient-health workloads until a written vendor health contract + controls exist
  ([HIPAA scoping](../apps/docs/docs/getting-started/hipaa.mdx)).
- Wire encryption (HTTPS + Cloudflare disk encryption) is **not** the main gap.
  Gaps are: who can read customer files, extra copies leaving Seal, thin
  “who opened the PDF” trails, no customer-held keys, shared prod tenancy.

## Gap list (what DocuSign-class buyers ask for)

| Gap | Why it matters for Seal alone | Track |
| --- | --- | --- |
| Human prod access to PDFs/DB without logged break-glass | Who *read* the record | SEA-68 **done** — session/signing downloads audited; `/internal/break-glass/document-read` + [runbook](./runbooks/break-glass-data-access.md) |
| No customer-held encryption keys | Only platform/Cloudflare keys | Later |
| Egress via email / webhooks / convert-AI | Extra copies of names + file bytes | SEA-70 |
| Signing audit strong; file-access audit weak | Lifecycle ≠ every storage read | SEA-44 done; SEA-68 extends |
| SIEM / stream export | Enterprise security teams pipe logs out | SEA-67 **done** — push `audit.entry.created` webhooks + NDJSON `/audit/export` |
| SAML SSO advertised, not implemented | Plan flag + marketing ahead of product | SEA-66 |
| Public subprocessors / DPA stub / breach runbook | RFP blank pages | SEA-69 **done** |
| External pen test | SEA-54 | External firm |
| Counsel on consent/retention | SEA-57 | Attorney |

## Optional reference (other products’ CompAI — steal ideas, don’t couple)

| Theme | Seen elsewhere | Seal action |
| --- | --- | --- |
| SAML SSO | Pile CompAI | SEA-66 — build for Seal buyers |
| Audit + SIEM | Pile CompAI | SEA-67 — Seal already has sealed logs; add export |
| SCIM / residency / bounty | Pile / Vortex CompAI | Later; status stub exists |
| Privacy surface | Vortex CompAI | SEA-69 **done** |
| Pen test | Vortex / SEA-54 | External |

Engineering may reuse a Vortex Auth SSO *library* if it already exists (wiring,
not a multi-product SKU). That is internal reuse — not “prepare for dual seat.”

## Suggested Seal attack order

1. **SEA-69** Privacy surface — **done**
2. **SEA-67** SIEM / audit export — **done** (push webhook + NDJSON pull)
3. **SEA-68** Data-access + break-glass logging — **done**
4. **SEA-70** Sensitive egress gates
5. **SEA-66** SAML SSO (real, not marketing checkbox)
6. **SEA-54** pen test

## CompAI SEA still open

- SEA-54 pen test (external)
- SEA-57 legal review (attorney)
- SEA-43 Vortex payments (Seal-as-customer / Agree.com — Phase 0 with Vortex)
- SEA-1 / SEA-3 marketing
- SEA-66, SEA-70 foundation
