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
| Embed schemas | ✓ audited — see below |
| Local PAdES seal | ✓ SEA-49 Level 1 on main (`final-pdf` + `pdf-seal`) |

### Embed schema audit (Seal vs Documenso / DocuSeal)

Seal today (`packages/sdk` `SealSigningEmbed` + `/sign/$token?embed=true`):

| Capability | Seal | Documenso-class | Decision |
| --- | --- | --- | --- |
| Token + iframe URL | ✓ | ✓ | keep |
| `theme` light/dark query | ✓ | ✓ | keep |
| `hideDecline` | ✓ | common | keep |
| Host events `ready/viewed/signed/declined/error` | ✓ | ✓ | keep |
| CSS variable / brand injection | — | Documenso `cssVars` | **skip** — branding already org-level on signer |
| Host lock / read-only embed | — | some | **skip** until a host needs it |
| Direct DOM embed (not iframe) | — | DocuSeal form | **skip** — iframe keeps auth/consent isolation |

No schema gap blocks shipping. Next embed work is chrome thinness inside `?embed=true` (same SEA-78 shell), not new props.

---

## Phase 3 — Pages / workflows

| Surface | Decision | Notes |
| --- | --- | --- |
| Guest signer `/sign/$token` | **keep** (done) | START → privacy → consent → PDF + one widget |
| Sender document builder | **adapt** | Keep placement canvas; delete dossier chrome that doesn't answer "can I send?" |
| Templates | **keep** | Agent-primary; UI is oversight list + light edit |
| Remind / void / resend | **keep** | Oversight actions — already API/MCP; UI stays thin |
| Embed host (`SealSigningEmbed`) | **keep** | Schema sufficient; prove `?embed=true` chrome matches guest |
| Settings (signing / branding / SSO) | **keep** | Enterprise surfaces stay; don't grow signer chrome from here |
| Activity / audit on signer | **skip** | Sender/oversight only |
| Agree.com-style marketing signer | **skip** | Not Seal's job (ADR-007) |

SEA-76 follow-through: sender builder density pass is the next UI cut after field-types land.

---

## Status

| Phase | Status |
| --- | --- |
| 1 Components (all types + shells) | **Done** (PR #774) |
| 2 Typed fieldMeta + embed audit | **Done** |
| 3 Page / workflow decisions | **Decided** — sender builder adapt is next ship |
| SEA-74 PDF paint | **Fixed** on main |
| SEA-75 / SEA-78 chrome | **Fixed** on main |
| SEA-73 PostHog guest mute | PR #775 |
| SEA-72 money-path probe | Guest path green (`painted=true`); sender/sealed-download still open |
