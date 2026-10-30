# E-sign lineup inventory — DocuSeal + Documenso → Seal

**Last refreshed:** 2026-10-30  
**Compare matrix:** `docs/oss-esign-ui-compare.md` (guest chrome truth table)  
**Doctrine:** ADR-007

**Process:**

1. **Components** — all building blocks (React + Kumo)
2. **Typed patterns** — Zod/field-meta/auth/embed
3. **Pages / workflows** — keep / adapt / skip per surface

UI kit: **`@cloudflare/kumo`**. Domain pieces under
`apps/web/src/components/{documents,signing,kumo-docs}`.

Canonical types: `apps/web/src/lib/field-types.ts` ↔
`apps/api/src/platform/field-types.ts` ↔ `apps/docs/openapi.yaml` `FieldType`.

Integrator contract (agents): **`apps/docs/openapi.yaml`** first — MCP / CLI /
SDK wrap it; published guides in `apps/docs/docs/`; not duplicated here.

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
| `SigningInviteGate` | ✓ `/sign/$token` — START before privacy/consent |
| `SigningShell` | ✓ PDF hero + one sticky widget (Documenso shape) |
| `SignerFormView` | ✓ SEA-86 — optional Fields list (mobile-friendly; adds chrome vs Documenso) |
| `SignerAuthGate` / `SignerAccountGate` | ✓ graded signer auth (SEA-48) before ceremony |
| PDF signing surface | ✓ SEA-74 — PDFium paint on guest route |
| Per-field inputs | ✓ all types |
| Privacy + ESIGN modals | ✓ SEA-52; SEA-75 hit-target polish as needed |
| Signature capture | ✓ incl. free_signature |
| Post-sign pay CTA | ✓ Vortex payable handoff on ceremony when configured |

---

## Phase 2 — Typed patterns

| Pattern | Status |
| --- | --- |
| Shared `FieldType` enum end-to-end | ✓ |
| Per-type `fieldMeta` Zod (Documenso-shaped) | ✓ `apps/api/src/platform/field-meta.ts` + web mirror |
| Flat properties + nested `meta` merge | ✓ `field-properties.ts` |
| Embed schemas | ✓ audited — see below |
| PAdES / sealed completion PDF | ✓ Worker pipeline + `scripts/lib/pades-verify.mjs` / golden path |
| Webhook delivery + SDK verify | ✓ `@vortex-api/seal` 0.3.x + OpenAPI `WebhookDeliveryPayload` |

### Embed schema audit (Seal vs Documenso / DocuSeal)

Seal today (`packages/sdk` `SealSigningEmbed` + `/sign/$token?embed=true`):

| Capability | Seal | Documenso-class | Decision |
| --- | --- | --- | --- |
| Token + iframe URL | ✓ | ✓ | keep |
| `theme` light/dark query | ✓ | ✓ | keep |
| `hideDecline` | ✓ | common | keep |
| Host events `ready/viewed/signed/declined/error` | ✓ | ✓ | keep |
| CSS variable / brand injection | — | Documenso `cssVars` | **skip** — org branding on signer |
| Host lock / read-only embed | — | some | **skip** until a host needs it |
| Direct DOM embed (not iframe) | — | DocuSeal form | **skip** — iframe keeps auth/consent isolation |

Next embed work = **same SEA-78 widget diet** inside iframe, not new props.

---

## Phase 3 — Pages / workflows

| Surface | Decision | Notes |
| --- | --- | --- |
| Guest signer `/sign/$token` | **keep** — **layout done**, **budget polish** | START → auth? → privacy → ESIGN → `SigningShell`. See compare doc “done vs next”. |
| Sender document builder | **adapt** | Placement canvas stays; SEA-79 trim dossier chrome |
| Templates | **keep** | Agent-primary; UI = oversight (`/{slug}/templates`) |
| Remind / void / resend | **keep** | API/MCP first; thin UI actions |
| Embed host (`SealSigningEmbed`) | **keep** | Prove parity with guest chrome under `?embed=true` |
| Settings (signing / branding / SSO) | **keep** | Enterprise; don’t export settings density to signer |
| Activity / audit on **guest** signer | **skip** | ✓ enforced — Activity on sender `$documentId` only |
| Agree.com-style marketing signer | **skip** | ADR-007 |

### Documenso-area map (where Seal invests)

| Documenso-style area | OpenAPI | Web UI | Agents |
| --- | --- | --- | --- |
| Send / documents | Full | Heavy builder | Primary |
| Templates | Full | Templates library | Primary |
| Teams | Members | Settings → Team | Partial |
| Guest sign | Public API | `/sign/$token` only | Humans sign — not agents |
| Webhooks / API keys | Full | Developer settings | Primary |
| Audit | Org audit + export | Audit log + doc activity | Primary |
| Analytics | Full | Analytics route | MCP |
| SaaS billing | Product-specific | Profile / usage | N/A |

---

## Status (rolling)

| Item | Status |
| --- | --- |
| Phase 1 components + shells | **Done** |
| Phase 2 typed patterns + PAdES + webhooks SDK | **Done** on main (2026-10) |
| Phase 3 guest layout (SigningShell, no guest Activity) | **Done** |
| Phase 3 guest chrome budget (SEA-78 remainder) | **Open** — header Decline/Download, widget CTA diet |
| SEA-74 PDF paint | **Done** |
| SEA-79 sender builder density | **Open** |
| SEA-72 hosted money path | **Done** — golden path + smoke-prod ceremony aligned |
| OSS compare doc | **Refreshed** 2026-10-30 — use matrix before UX tickets |

When filing UX work, cite **`docs/oss-esign-ui-compare.md`** “Seal today” row —
do not reopen deleted guest sidebar scope.
