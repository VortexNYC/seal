# E-sign lineup inventory — DocuSeal + Documenso → Seal

**Process:**

1. **Components** — all building blocks (React + Kumo)
2. **Typed patterns** — Zod/field-meta/auth/embed
3. **Pages / workflows** — keep / adapt / skip per surface

UI kit: **`@cloudflare/kumo`**. Domain pieces under
`apps/web/src/components/{documents,signing,kumo-docs}`.

Canonical types: `apps/web/src/lib/field-types.ts` ↔
`apps/api/src/platform/field-types.ts` ↔ `apps/docs/openapi.yaml` `FieldType`.

---

## Phase 1 — Field / signing components

### Field types (full grab)

| Type | Documenso | DocuSeal | Seal |
| --- | --- | --- | --- |
| signature | ✓ | ✓ | ✓ |
| free_signature | FREE_SIGNATURE | (sig step) | ✓ |
| initials | ✓ | ✓ | ✓ |
| name | ✓ | — | ✓ |
| email | ✓ | — | ✓ |
| text | ✓ | ✓ | ✓ |
| number | ✓ | ✓ | ✓ |
| date | ✓ | ✓ | ✓ |
| date_signed | meta | datenow | ✓ |
| checkbox | ✓ | ✓ | ✓ |
| radio | ✓ | ✓ | ✓ |
| dropdown | ✓ | select | ✓ |
| multi_select | — | multiple | ✓ |
| attachment | — | file | ✓ |
| image | — | ✓ | ✓ |
| payment | — | ✓ | ✓ |
| phone | — | ✓ | ✓ |
| cells | — | ✓ | ✓ |
| stamp | — | ✓ | ✓ |
| heading | — | ✓ | ✓ |
| strikethrough | — | ✓ | ✓ |
| verification | — | ✓ | ✓ (stub provider) |
| kba | — | ✓ | ✓ (stub provider) |

**23 types.** Toolbar + placement + `FieldInputManager` + overlays wired.

### Signing building blocks

| Block | Status |
| --- | --- |
| `SigningInviteGate` | ✓ wired on `/sign/$token` (START before privacy/consent) |
| `SigningShell` | ✓ wired on `/sign/$token` (PDF hero + one sticky widget) |
| PDF signing / placement surfaces | ✓ paint fix SEA-74 (direct PDFium engine) |
| Per-field inputs | ✓ all types |
| Consent / auth gate | ✓ existing (+ SEA-75 larger consent hit target) |
| Signature capture | ✓ (also free_signature) |

---

## Phase 2 — Typed patterns

| Pattern | Status |
| --- | --- |
| Shared `FieldType` enum end-to-end | ✓ |
| Per-type `fieldMeta` Zod (Documenso-shaped) | ✓ `apps/api/src/platform/field-meta.ts` + web mirror |
| Flat properties + nested `meta` merge | ✓ `field-properties.ts` |
| Embed schemas | Audit vs Documenso embed-* — next |
| Local PAdES seal | SEA-49 class |

---

## Phase 3 — Pages / workflows

Guest signer (`/sign/$token`) adapted to SEA-78: invite START → privacy →
consent → PDF + one progress widget + Complete/Decline. Remaining walk:
sender builder → templates → remind/void → embed → settings.

---

## Status

| Phase | Status |
| --- | --- |
| 1 Components (all types + shells) | **Done** |
| 2 Typed fieldMeta | **Done** (embed schemas + PAdES still open) |
| 3 Page / workflow decisions | **In progress** (guest signer done) |
| SEA-74 PDF paint | **Fixed** (direct engine; needs deploy) |
| SEA-75 / SEA-78 chrome | **Fixed** on guest signer (needs deploy) |
