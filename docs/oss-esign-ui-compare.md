# OSS e-sign UI compare (local launch)

**Last refreshed:** 2026-10-30  
**Seal reference:** `apps/web/src/routes/sign.$token.tsx`, `apps/web/src/components/signing/signing-shell.tsx`  
**Doctrine:** ADR-007 · tickets SEA-74 (PDF paint), SEA-78 (signer chrome budget), SEA-86 (Form View)

**Clones (optional local):** `~/Projects/oss-esign-compare/{docuseal,documenso,OpenSign}`  
**Ports (historical):** DocuSeal `:3110` · OpenSign `:3120`/`:3180` · Documenso `:3130` (DB `:54320`)

## Verdict

**We don’t need DocuSign.** Frontend appears when it’s meant to (ADR-007). Steal
DocuSeal + Documenso juice only. Ignore OpenSign density.

**Seal guest signer (Oct 2026):** Layout shape matches **Documenso** (`SigningShell`:
PDF column + one sticky widget, mobile bottom dock). **Chrome budget** is still
heavier than DocuSeal/Documenso: pre-PDF gate stack (auth → START → privacy →
ESIGN), widget progress meter + “Next field” + sign CTA, and **Fields / Document**
toggle (`SignerFormView`, SEA-86). **Sender** Activity / Recipient Details live on
`$documentId` + `document-sidebar.tsx` only — not on the guest route.

**Trust path:** Hosted golden path + PAdES verify green; not an OSS UI gap.

## Juice inventory (steal checklist)

### DocuSeal

| Juice | Seal status (2026-10-30) |
| --- | --- |
| Invite: title + invited-by + email + **START** | **Done** — `SigningInviteGate` before privacy/consent |
| Thin header: title · Decline · Download | **Done** — header Decline + Download (`signer-header-*`) |
| PDF full-bleed under header | **Done** — `PdfSigningDocumentSurface` (SEA-74 PDFium path) |
| One field CTA (`NEXT`) + micro step dots | **Done** — single `signer-primary-action` (Continue → Sign) |
| Embeddable form mindset (`docuseal-form`) | **Partial** — `@vortex-api/seal/react` iframe + `?embed=true`; inner chrome same as guest |

### Documenso

| Juice | Seal status (2026-10-30) |
| --- | --- |
| PDF + **one** sticky signing widget (~350px) | **Done** — `SigningShell` (`max-w-88` widget, `md:sticky`) |
| Fields + Complete inside that widget only | **Done** — one primary CTA + short field hint; overlays on PDF |
| Mobile = same widget as bottom sheet | **Done** — fixed bottom bar → sticky on `md+` |
| PAdES / sealed PDF on complete | **Done** — Worker `final-pdf` + dogfood/openssl prove (not Documenso’s local `.p12` path) |

### Explicitly not juice (still refuse)

Recipient Details on **guest** signer · Activity timeline on **guest** signer ·
DocuSign feature parity theater · OpenSign-style PdfHeader kitchen-sink on signer.

## Signer chrome matrix

| Element | DocuSeal (reference) | Documenso (reference) | OpenSign (caution) | Seal today |
| --- | --- | --- | --- | --- |
| PDF as hero | Full page under thin header | Left column viewer | Yes, buried in tooling | **Yes** — main column; Form View hides PDF but keeps mount |
| Pre-sign gates | START on invite | Token → sign page | Heavy guest login | **Auth** (OTP/access code) → optional account → **START** → privacy modal → ESIGN modal |
| Persistent header | Title · Decline · Download | Title · invite · Reject | Dense PdfHeader | Title · instruction · **Decline · Download** in header |
| Layout | No sidebar | PDF + ~350px widget | Sidebar + tools | **`SigningShell`** — PDF + one widget (no dossier sidebar) |
| Progress | Dots in field flow | Field list in widget | Scattered | One-line hint + **single** primary CTA |
| Primary CTA | NEXT → complete | One Complete in widget | Finish in header | **`signer-primary-action`** (Continue or Sign) |
| Recipient Details | No | No | N/A | **No** on guest (sender doc sidebar only) |
| Activity / timeline | No | No | Sender reports | **No** on guest (sender doc sidebar + analytics) |
| Consent | Links on invite | Org branding elsewhere | Admin ToS | **Modals** once (privacy then ESIGN) — audit by design |
| Mobile | Same flow, thin | Widget as bottom sheet | Cramped | Widget fixed bottom; Form View for field list (SEA-86) |
| Post-complete | Download | Download | Varies | Download + optional redirect + **Pay now** (Vortex payable) |

## What each product teaches

### DocuSeal — north star for **chrome budget**

- Invite: centered card, email, **START**
- Signing: thin header (Decline · Download), PDF canvas, **one** field CTA (`NEXT`)
- No dossier, no activity on the guest path

### Documenso — north star for **layout shape**

- `flex`: PDF (`flex-1`) + single sticky widget (~350px)
- Widget holds instructions, field list, **one** Complete
- Mobile: same widget, bottom sheet — still **one** surface

### OpenSign — cautionary tale

- Signer page packed with sender-grade tools
- Activity belongs in oversight routes — Seal must not regress guest Activity

## Seal guest signer — done vs next (SEA-78)

**Shipped (do not re-litigate as “missing layout”):**

1. `SigningShell` — Documenso-shaped layout (`sign.$token.tsx` return)
2. `SigningInviteGate` — DocuSeal-style START before legal modals
3. Removed guest **Recipient Details** and **Activity** (oversight on `$documentId`)
4. SEA-74 — PDF paints via signing PDF surface (not blank SPA shell)
5. PAdES markers on completed PDF (prove wall / golden path)

**Remaining polish (same ADR-007 end-state):**

> title · PDF + fields · **one** progress · **one** CTA · Decline · consent once

1. ~~**Header actions** — Decline + Download in `SigningShell.headerActions`~~ **Done** (2026-10-30)
2. ~~**Widget diet** — single `signer-primary-action` (Continue → Sign)~~ **Done** (2026-10-30)
3. ~~**Form View** — desktop defaults to Document; toggle **`md:hidden`** (mobile only)~~ **Done** (2026-10-30)
4. **Gate stack** — keep audit requirements; avoid new pre-PDF chrome
5. **Embed** — inherits shell changes via `?embed=true`; verify in dogfood/e2e if regressions

**Code anchors:**

| Concern | Location |
| --- | --- |
| Guest route | `apps/web/src/routes/sign.$token.tsx` |
| Layout shell | `apps/web/src/components/signing/signing-shell.tsx` |
| Form View list | `apps/web/src/components/signing/signer-form-view.tsx` |
| Sender Activity | `apps/web/src/components/documents/document-sidebar.tsx` |
| E2E ceremony | `apps/web/e2e/` signing POM + `data-testid` on view toggle / next-field |

## Sender surface (separate from guest)

Documenso-style **dashboard/builder** density is intentionally on authenticated
routes (`$documentId`, templates, analytics). ADR-007 + **SEA-79**: trim sender
chrome that doesn’t answer “can I send?” — Activity stays **sender-only** (correct).

## Docs / contract (integrator story)

Product UI compare stops at guest + sender SPA. **Integrators** use OpenAPI
(`apps/docs/openapi.yaml` → `/reference`), MCP, `@vortex-api/seal` — not Documenso’s
app-first docs shape. See `docs/oss-esign-component-lineup.md` Phase 3 + ADR-003.

## Ports / how to relaunch (optional)

```bash
# DocuSeal
docker start seal-docuseal-compare   # http://127.0.0.1:3110

# OpenSign
cd ~/Projects/oss-esign-compare/OpenSign
docker compose -f docker-compose.compare.yml up -d   # :3120 UI, :3180 API

# Documenso
cd ~/Projects/oss-esign-compare/documenso
PORT=3130 npm run dev   # postgres :54320 per local compose
```

Historical screenshots: `/tmp/oss-esign-compare/*.png` (Sep 2025 pass).
