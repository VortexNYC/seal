# Classic self-serve e-sign UX — active spec

**Status:** active · **Audience:** humans who use Seal's classic UI themselves
(not agents). **Doctrine:** ADR-003 (agents drive; UI is oversight) + ADR-007
(frontend appears when needed) — this doc is the *exception path*: people who
want DocuSign/Dropbox-Sign-class self-serve must still get a buttery solo flow.

**Source questions (founder, 2026-09-28):**

> Open an account → add first/last name → accept signature style → upload 1st
> PDF → sign for themselves → auto date it → hit sign → get email with the
> secured PDF → done.

**Answer:** not yet perfect — closing the gap against Documenso OSS
(**design reference only, zero AGPL code**).

---

## 0. What we ripped from Documenso (behavior)

Local clone `/tmp/documenso` (AGPL-3.0). Steal product contracts; rewrite
clean-room in Seal:

| Documenso | Seal port |
|---|---|
| `AUTO_SIGNABLE_FIELD_TYPES` = NAME/INITIALS/EMAIL/DATE | `auto-sign-fields.ts`: `date_signed` / `name` / `email` / `initials` |
| DATE → `DateTime.now()` on sign | `date_signed` → `YYYY-MM-DD` on recipient submit |
| Completion email requires `downloadLink` | `DocumentCompleted` + sealed-copy mail with `downloadUrl` |
| Completion job attaches sealed PDF to every party | Attach when ≤8 MiB; always include download link |
| Email every recipient + owner on complete | Same — interim “you signed” only while others remain |
| Draw / Type / Upload signature dialog | Already in Seal `SignatureCapture` |
| “Add myself” on recipients step | Already in Seal `AddMyselfDialog` |
| Placeholder auto-place | SEA-85 — OCR/`fieldCandidates` one-tap (open) |

---

## 1. Founder checklist → Seal truth

| Expectation | Seal | Gap |
|---|---|---|
| Signature style adopt | draw/type/upload + saved sigs | First-run onboarding (**SEA-84**) |
| Auto date | Server auto-stamp on submit | Landing on this branch |
| Sealed PDF in inbox | Download link + attachment on complete | Landing on this branch |
| Add Myself + multi-signer | Exists | Local Mark/Lenore prove |
| OCR one-tap place | Detect only | **SEA-85** |
| ≤6 clicks solo path | Not measured | **SEA-83** |

---

## 2. Work items (SEA)

| Ticket | Outcome | Priority |
|---|---|---|
| **SEA-81** | Sealed PDF download (+ attachment) in completion mail | high |
| **SEA-82** | Auto-stamp `date_signed` / name / email / initials | high |
| **SEA-83** | Solo first-doc E2E ≤6 clicks | high |
| **SEA-84** | Signature style first-run adopt | medium |
| **SEA-85** | OCR one-tap accept | medium |
| **SEA-86** | Mobile Form View | medium |
| **SEA-87** | Field-catalog E2E matrix | low |

---

## 3. Non-goals

- Fat DocuSign-parity chrome
- Copying Documenso AGPL source
- Review-matrix SPA UI
- Replacing OpenAPI as the contract
