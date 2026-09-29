# Classic self-serve e-sign UX — active spec

**Status:** active · **Audience:** humans who use Seal's classic UI themselves
(not agents). **Doctrine:** ADR-003 (agents drive; UI is oversight) + ADR-007
(frontend appears when needed) — this doc is the *exception path*: people who
want DocuSign/Dropbox-Sign-class self-serve must still get a buttery solo flow.

**Source questions (founder, 2026-09-28):**

> Open an account → add first/last name → accept signature style → upload 1st
> PDF → sign for themselves → auto date it → hit sign → get email with the
> secured PDF → done.
>
> Do we have this flow down perfect? Classic signature flows properly tested?
> All field components (name, date, signature, …)? OCR auto-positioning?
> As few clicks as possible?

**Answer today: no.** Gaps below are the product truth. Do not claim perfection.

---

## 1. Founder checklist → Seal truth

| Expectation | Seal today | Gap |
|---|---|---|
| Account + first/last name | Auth + profile exist | No guided first-doc onboarding that collects name + signature style as one beat |
| Accept signature style (draw / type / upload) | Saved signatures + draw/type/upload exist on signer | No first-run "adopt your style" step before first send/self-sign |
| Upload 1st PDF | Upload path works | Friction: multipage chrome, not a 3-click happy path |
| Sign for themselves | Self-sign possible via recipients / own signing | Multi-click; not a one-surface "Sign myself" default |
| Auto date (`date_signed`) | Field type exists in catalog | Not auto-stamped on complete; signer still interacts |
| Hit sign → sealed PDF | Final/sealed PDF pipeline exists (API prove) | Completion email often lacks download URL / attached sealed PDF |
| Inbox delivery of secured PDF | Signing-complete email template | Missing sealed download in the mail recipients actually open |
| All field types tested E2E | Catalog ≈23 types; unit/API coverage growing | Playwright golden path still thin (≈4 field types historically) |
| OCR auto-places fields | `fieldCandidates` / detect exists | Detect ≠ execute — suggestions are not one-click place |
| Minimum clicks | Not measured | No click-budget for solo first-doc; incumbents target ~5–8 actions |

---

## 2. Classic modern 2026 expectations (research notes)

Firecrawl credits exhausted this run; sources via public web research (2025–2026).

### 2.1 What "buttery" means in 2026

Incumbent bar (DocuSign, Adobe Acrobat Sign, Dropbox Sign / HelloSign, PandaDoc):

1. **Mobile-first signing without an app** — ~65–70% of completions on phone;
   pinch-to-zoom PDF is a conversion killer. Expect responsive reflow *or*
   Form View / field-list mode (Dropbox Form View + Drawer Flow; Adobe Mobile
   Focus; DocuSign responsive HTML signing).
2. **Guided field tour** — Get Started → next required field → red asterisks →
   "Next required" when skipped → green banner when ready → explicit Agree /
   Submit with ToS. (Dropbox Sign signer page is the clearest reference.)
3. **Signature creator with 3–4 modes** — draw, type, upload, (optional) phone
   camera. Adopt once; reuse. Default type configurable.
4. **Auto fields** — `date_signed`, name, email prefilled from recipient identity;
   no retyping. Auto-fill must be opt-in where PII risk exists.
5. **Completion artifact in inbox** — email with sealed PDF *or* durable download
   link; certificate of completion available.
6. **Sender solo path** — upload → place fields (or accept AI/OCR suggestions)
   → "Sign myself" / send → done in minutes. Dropbox Sign's reputation is still
   the simplicity north star for SMBs; DocuSign is the enterprise workflow bar.
7. **SMS/link delivery + nudges** — text-to-sign and open-but-not-signed reminders
   are table stakes for B2C; email-only is lagging.
8. **Predictive / AI assist (2026 frontier)** — field suggestions from layout/OCR;
   optional 3-bullet term summary for trust. Seal already has detect primitives;
   execute path is the gap.
9. **Embedded signing** — iframe/API embed for host apps (not SPA-only). Seal's
   OpenAPI/MCP story is ahead here for agents; classic UI still needs the same
   low-friction chrome for humans.

### 2.2 Seal product stance

- **Agents/MCP remain primary** for create/send (ADR-003).
- **Classic UI** must still clear the solo human bar above for people who refuse
  agents — especially Vortex day-to-day docs (SEA-59 / ADR-005).
- Prefer **Delete** over a DocuSign clone: one composition, field tour, signature
  adopt, sealed email. No feature zoo.

---

## 3. Target solo first-doc flow (click budget)

Proposed maximum for a returning authenticated user who already has a name:

1. Upload PDF (drag-drop)
2. Accept suggested signature + date fields (or one-tap "Sign myself" template)
3. Adopt / confirm signature style (once per account)
4. Sign
5. Done screen + sealed PDF in inbox

Hard cap: **≤6 intentional clicks** after auth for the happy path. Measure in E2E.

---

## 4. Work items (SEA)

| Ticket | Outcome | Priority |
|---|---|---|
| **SEA-81** | Completion email includes sealed/final PDF download | high |
| **SEA-82** | Server auto-stamps `date_signed` on complete | high |
| **SEA-83** | Playwright solo first-doc E2E (≤6 clicks after auth) | high |
| **SEA-84** | Signature style first-run adopt (draw/type/upload) | medium |
| **SEA-85** | OCR `fieldCandidates` → one-tap accept on canvas | medium |
| **SEA-86** | Mobile signer Form View / no pinch-zoom | medium |
| **SEA-87** | Expand field-catalog E2E beyond core four | low |

Implementation order: **SEA-81 → SEA-82 → SEA-83** (inbox PDF tip of spear), then SEA-84/85, then SEA-86. SEA-87 can parallelize.

---

## 5. Non-goals

- Fat DocuSign-parity sender chrome
- Building review-matrix UI in the SPA (ADR-006 stays agent/MCP)
- Replacing OpenAPI as the contract
