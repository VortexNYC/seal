# Classic self-serve e-sign UX — active spec

**Status:** active · **Audience:** humans who use Seal's classic UI themselves.

**Sources:** Documenso + **DocuSeal** OSS (design reference only — no AGPL /
proprietary copy). Founder checklist 2026-09-28.

---

## 0. Loot table

### Documenso → Seal
| Behavior | Seal |
|---|---|
| AUTO_SIGNABLE name/email/initials/date | `auto-sign-fields.ts` |
| Completion mail + downloadLink + PDF attach | SEA-81 landed |
| Add myself / Draw·Type·Upload | Already present |

### DocuSeal → Seal
| Behavior | Seal |
|---|---|
| Profile-saved default signature | SEA-84: first-run **Adopt your signature** + default auto-select |
| START gate before signing | Already on `/sign/$token` |
| ESIGN certs / verify PDF | Seal PAdES (SEA-49) — keep native |
| MCP + API-first | Seal already MCP/OpenAPI-first |
| Field detect → place | SEA-85: suggestions pre-selected → **Accept all** one tap |
| Guided next-field tour | Signer sticky **Next field** CTA + auto-scroll on open (Dropbox-class) |
| Webhook HMAC / compliance knobs | Prefer existing Seal webhooks; file SEA if gap |

---

## 1. Status

| Item | State |
|---|---|
| SEA-81 sealed inbox PDF | done |
| SEA-82 auto date/name/email/initials | done |
| SEA-84 signature adopt | landing |
| SEA-85 OCR/detect Accept all | landing |
| SEA-83 solo E2E | open |
| SEA-86 mobile Form View | open |
| SEA-87 field-catalog E2E expand | open |
| Recipient roles (signer / viewer / approver) | done |
| Default recipient auth = email OTP | done (org can require) |
| Signer Seal account gate (audit identity) | done (org `requireSignerAccount`) |
| Compliance onboarding seeds signing defaults | done (`/{slug}/onboarding/compliance`) |
| Mobile/portrait clarity on auth + account gates | landing |
| Signer jump-to-next-field (placement ready) | landing |

---

## 1a. Identity flow (recipient)

1. Sender adds recipient with role + auth (default **email OTP**).
2. Send blocked if org `requireRecipientAuth` and any signer/approver is link-only.
3. Email → `/sign/$token` → OTP/access code (if set) → **Create account / Sign in** when `requireSignerAccount` → START → privacy → ESIGN → fields.
4. Submit requires session email matching the invitation when account is required.

## 1b. Signer guided fields (Dropbox-class)

After gates clear, sender-placed fields must already be on the PDF overlay.
Signer must not hunt by scrolling:

1. On PDF ready → auto-scroll + highlight first unfilled required field.
2. Persistent **Next field** control jumps to the next unfilled (page + position order).
3. After a field save → auto-advance to the next unfilled and open it.
4. When none remain → primary action is Submit / Sign (no scavenger hunt).

## 2. Local Mark → Lenore prove

**Status: NOT DONE — required before sending to in-laws.**

Checklist (must pass on the build that will be live):

1. `pnpm run dev` (api :8787, web :5180) — or dogfood on `app.seal.nyc` after deploy
2. Upload GREENMAR (or sample) PDF
3. Place signature + date fields for Mark and Lenore (or Accept all)
4. Add both as **Signer** with **email OTP** (org default)
5. Send → both get invite mail
6. **Mark:** open link → OTP from email → create/sign-in Seal account with *exact* invite email → START → privacy → ESIGN → guided field → sign
7. **Lenore:** same path (after Mark if sequential; parallel if same order)
8. Completion mail with sealed PDF for both + sender
9. Repeat once in **portrait / narrow viewport**

Until 6–9 are green on the deployed build, do not send the real family packet.

---

## 3. Target solo first-doc flow (click budget)

Returning authenticated user who already has a name:

1. Upload PDF
2. Accept suggested signature + date (or place once)
3. Adopt / confirm signature style (once)
4. Sign
5. Done + sealed PDF in inbox

Hard cap: **≤6 intentional clicks** after auth. Measure in SEA-83 E2E.

---

## 4. Non-goals

- Copy DocuSeal AGPL / additional-terms code
- Fat DocuSign chrome
- Review-matrix SPA (ADR-006 stays agent/MCP)
