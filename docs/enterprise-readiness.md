# Enterprise / regulated readiness — Seal foundation backlog

Working notes after SEA-51 HIPAA scoping + cross-read of Pile CompAI enterprise
tickets (PILE-185 SAML, PILE-186 audit/SIEM, PILE-187 SCIM/residency/status/bounty)
and Vortex privacy cluster (VOR-565/566/567/569).

**Not waiting on VOR-571.** Vortex dogfood can proceed in parallel.

## Plain-English posture

- Seal is a general e-sign platform. We do **not** claim HIPAA compliance or sell
  patient-health workloads until a written vendor health contract + controls exist
  ([HIPAA scoping](../apps/docs/docs/getting-started/hipaa.mdx)).
- Wire encryption (HTTPS + Cloudflare disk encryption) is **not** the main gap.
  Gaps are: who can read customer files, extra copies leaving Seal, thin
  “who opened the PDF” trails, no customer-held keys, shared prod tenancy.

## Gap list (technical / process)

| Gap | Why it matters | Track |
| --- | --- | --- |
| Human prod access to PDFs/DB without logged break-glass | Hospitals/gov care who *read* the record | Filed foundation ticket (data-access audit) |
| No customer-held encryption keys | Only platform/Cloudflare keys | Later; after access audit |
| Egress via email / webhooks / convert-AI | Extra copies of names + file bytes | Filed (sensitive egress gates) |
| Signing audit strong; file-access audit weak | Lifecycle ≠ every storage read | SEA-44 done; extend downloads + admin paths |
| SIEM / stream export | Enterprise buyers pipe logs out | Twin of PILE-186 |
| SAML SSO advertised, not implemented | Plan flag + marketing ahead of product | Twin of PILE-185 |
| Public subprocessors / DPA stub / breach runbook | RFP blank pages | Twin of VOR-566 |
| External pen test | SEA-54 | External firm |
| Counsel on consent/retention | SEA-57 | Attorney |

## Pile / Vortex twins (same CompAI table)

| Theme | Pile | Vortex | Seal |
| --- | --- | --- | --- |
| SAML SSO | PILE-185 | — | Foundation ticket (prefer Core shared) |
| Audit + SIEM | PILE-186 | — | Seal sealed audit ahead; SIEM stream shared gap |
| SCIM / residency / status / bounty | PILE-187 | VOR-567 bounty, VOR-569 SOC | Status stub exists; SCIM/residency later |
| HIPAA memo | — | VOR-565 (payments BA) | SEA-51 **done** (decline until expand) |
| Privacy surface | — | VOR-566 | Foundation ticket |
| Pen test | — | VOR-567 | SEA-54 |

**Rule of two:** SAML and SIEM stream should not be hand-rolled three times — lift to
`@vortexnyc/*` / Vortex Auth when the second consumer needs it. Seal can ship a
thin consumer path; Core owns the primitive.

## Suggested Seal attack order (foundation)

1. **SEA-69** Privacy surface docs (subprocessors, breach runbook, DPA stub) — fast RFP unblock
2. **SEA-67** SIEM / audit export — builds on existing sealed logs
3. **SEA-68** Data-access + break-glass logging — closes the “who read the PDF” hole
4. **SEA-70** Sensitive egress gates — webhook minimal payloads + AI/convert kill switch
5. **SEA-66** SAML SSO — Core-first with Pile; don’t fake the marketing checkbox
6. **SEA-54** pen test — after 1–4 so the firm isn’t testing a blank privacy story

Filed as SEA-66 … SEA-70 (moved off accidental VTX identifiers).

## CompAI SEA still open

- SEA-54 pen test (external)
- SEA-57 legal review (attorney)
- SEA-43 Vortex payments (wait VOR-571 ceremony)
- SEA-1 / SEA-3 marketing
