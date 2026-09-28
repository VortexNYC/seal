# OSS e-sign UI compare (local launch)

**Date:** 2026-09-25  
**Clones:** `~/Projects/oss-esign-compare/{docuseal,documenso,OpenSign}`  
**Local ports:** DocuSeal `:3110` · OpenSign `:3120`/`:3180` · Documenso `:3130` (DB `:54320`)

## Verdict

**We don’t need DocuSign.** Frontend appears when it’s meant to (ADR-007). Steal
DocuSeal + Documenso juice only. Ignore OpenSign density.

Seal’s signer (`sign.$token.tsx`) is the densest of the four. SEA-78 is the doctrine ticket; SEA-74 (blank PDF) is still the tip of the spear — chrome strip is worthless until the PDF paints.

## Juice inventory (steal checklist)

### DocuSeal

| Juice | Seal status |
| --- | --- |
| Invite: title + invited-by + email + **START** | Missing — consent then full chrome |
| Thin header: title · Decline · Download | Partial — too much else |
| PDF full-bleed under header | Broken (SEA-74) |
| One field CTA (`NEXT`) + micro step dots | Missing — multi progress + sidebar |
| Embeddable form mindset (`docuseal-form`) | Partial — SDK exists; signer not embed-thin |

### Documenso

| Juice | Seal status |
| --- | --- |
| PDF + **one** sticky signing widget (~350px) | Missing — 380–420px dossier sidebar |
| Fields + Complete inside that widget only | Missing |
| Mobile = same widget as bottom sheet | Missing |
| Local PAdES seal on complete (`.p12` + `@libpdf/core`) | Gap (SEA-49 class) |

### Explicitly not juice

Recipient Details on signer · Activity timeline on signer · triple progress ·
PdfHeader kitchen-sink · DocuSign feature parity theater.

## Live status (this session)

| App | Status | What we saw |
| --- | --- | --- |
| **DocuSeal** | Up `:3110` (admin already set up) | Public demo invite + live signing surface captured |
| **OpenSign** | Up `:3120` client / `:3180` server | Admin setup form live; guest sign path is code-reviewed |
| **Documenso** | Postgres migrated on `:54320`; remix printed `:3130` then dropped the bind (Vite flaky post-partial `npm ci`) | Signer layout proven from source (`document-signing-page-view-v1.tsx`) — enough for chrome doctrine |

## Signer chrome matrix

| Element | DocuSeal (live) | Documenso (code) | OpenSign (code) | Seal today |
| --- | --- | --- | --- | --- |
| PDF as hero | Yes — full page under thin header | Yes — left column `PDFViewerLazy` | Yes — but surrounded by heavy header tooling | Broken (SEA-74) + squeezed by 380–420px sidebar |
| Invite gate | Title + “Invited by X” + email + **START** | Token URL → sign page | GuestLogin: name/phone/email/job/company + OTP paths | Consent dialog then full chrome |
| Persistent header | Title · Decline · Download | Title · invite line · Attachments · Reject | PdfHeader: back, print, download, reorder, merge, decline, finish… | Collapsible doc meta + recipient/role |
| Progress | Tiny step dots inside field modal only | Field list inside one widget | Scattered (reports Activity, page UI) | Progress bar **+** field counts **+** other indicators |
| Sidebar | **None** | One sticky ~350px widget: “Sign Document” + fields + Complete | Sidebar store + dense tools | **380–420px:** About / Progress / **Recipient Details** / **Activity** |
| Primary CTA | **NEXT** (per field) → complete | One Complete in widget | Finish in header | Multiple competing actions |
| Recipient Details panel | No | No | No (signer already is the recipient) | **Yes — delete** |
| Activity / timeline | No | No (audit is post-hoc) | Activity in sender reports | **Yes on signer — delete** |
| Consent | Privacy + eSign Disclosure links on invite | Branding/legal elsewhere | ToS on admin setup | Modal gate (keep once, not as chrome) |

## What each product teaches

### DocuSeal — north star for chrome budget

Invite (`start_form/show.html.erb`): centered `max-w-md`, banner, one sentence, doc card, email, **START**.

Signing (`submit_form/show.html.erb` + live demo):
- Sticky thin header: title + Decline + Download
- Document is the canvas
- Guided field modal with **one** CTA (`NEXT`) and micro step dots
- No recipient dossier, no activity feed, no second progress bar

### Documenso — north star for layout shape

`document-signing-page-view-v1.tsx`:
- Title + one invite sentence + Reject/Attachments
- `flex`: PDF card (`flex-1`) + single sticky widget (`md:w-[350px]`)
- Widget = role title + short instruction + `DocumentSigningForm` + Complete
- Mobile: bottom sheet expand/collapse — still **one** widget

### OpenSign — cautionary tale

- Admin setup asks for six fields + newsletter before any product value
- `PdfHeader.jsx` / `PdfRequestFiles.jsx` pack print/download/reorder/merge/decline/finish into signer space
- Activity belongs in sender reports, not the guest signing path — Seal currently copies the wrong surface

## Seal delete list (SEA-78)

From `apps/web/src/routes/sign.$token.tsx` (~1268–1400+):

1. **Delete** sidebar “Recipient Details” block (signer already knows who they are)
2. **Delete** sidebar “Activity” / timeline on the signer route
3. **Collapse** progress to **one** indicator (prefer in-document / next to the single CTA — DocuSeal dots or Documenso field list, not a third bar)
4. **Delete** mobile collapsible that re-states recipient + role once the PDF is the hero
5. **Keep** consent once (gate), Decline, and a single Complete/Sign CTA
6. **Keep** PDF surface — but it must paint first (**SEA-74**)

Target end state:

> title · PDF + fields · one progress · one CTA · Decline · consent once

## Ports / how to relaunch

```bash
# DocuSeal
docker start seal-docuseal-compare   # http://127.0.0.1:3110

# OpenSign
cd ~/Projects/oss-esign-compare/OpenSign
docker compose -f docker-compose.compare.yml up -d   # :3120 UI, :3180 API

# Documenso deps
cd ~/Projects/oss-esign-compare/documenso
# postgres on :54320 (compose service `database`), redis :63790, mail :2500/:9010
PORT=3130 npm run dev
```

Screenshots from this pass: `/tmp/oss-esign-compare/*.png`
