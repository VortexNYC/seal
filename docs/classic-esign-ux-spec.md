# Classic self-serve e-sign UX — active spec

**Status:** active · **Audience:** humans who use Seal's classic UI themselves.

**Sources:** Documenso + **DocuSeal** OSS (design reference only — no AGPL /
proprietary copy). Founder checklist 2026-09-28.

**Gate:** §2 Mark→Lenore prove is **green** on deployed `app.seal.nyc`
(2026-09-29). Family / in-law packets may proceed.

---

## 0. Loot table

### Documenso → Seal

| Behavior                                    | Seal                  |
| ------------------------------------------- | --------------------- |
| AUTO_SIGNABLE name/email/initials/date      | `auto-sign-fields.ts` |
| Completion mail + downloadLink + PDF attach | SEA-81 landed         |
| Add myself / Draw·Type·Upload               | Already present       |

### DocuSeal → Seal

| Behavior                        | Seal                                                     |
| ------------------------------- | -------------------------------------------------------- |
| Profile-saved default signature | SEA-84: first-run **Adopt your signature**               |
| START gate before signing       | `/sign/$token`                                           |
| ESIGN certs / verify PDF        | Seal PAdES (SEA-49)                                      |
| MCP + API-first                 | OpenAPI + MCP                                            |
| Field detect → place            | SEA-85: **Accept all**                                   |
| Guided next-field tour          | Sticky **Next field** + auto-advance                     |
| Mobile Form View                | SEA-86: Fields / Document toggle (phone defaults Fields) |
| Webhook HMAC / compliance knobs | Prefer existing Seal webhooks                            |

---

## 1. Status

| Item                                 | State                                |
| ------------------------------------ | ------------------------------------ |
| SEA-81 sealed inbox PDF              | **done**                             |
| SEA-82 auto date/name/email/initials | **done**                             |
| SEA-84 signature adopt               | **code done** — dogfood once on live |
| SEA-85 OCR/detect Accept all         | **code done** — dogfood once on live |
| SEA-83 solo / guided E2E             | **done** (Playwright)                |
| SEA-86 mobile Form View              | **done** (proved on prod 2026-09-29) |
| SEA-87 field-catalog E2E expand      | open (non-blocking for Mark→Lenore)  |
| Recipient roles                      | done                                 |
| Default recipient auth = email OTP   | done                                 |
| Signer Seal account gate             | done                                 |
| Compliance onboarding                | done                                 |
| Signer jump-to-next-field            | **done**                             |

---

## 1a. Identity flow (recipient)

1. Sender adds recipient with role + auth (default **email OTP**).
2. Send blocked if org `requireRecipientAuth` and any signer/approver is link-only.
3. Email → `/sign/$token` → OTP → Create account / Sign in when required → START → privacy → ESIGN → **Fields** (mobile) or Document → sign.
4. Submit requires session email matching the invitation when account is required.

## 1b. Signer guided fields

1. Sender-placed fields appear on PDF overlay **and** in Form View list.
2. Phone defaults to **Fields** (no pinch-zoom hunt).
3. On ready → open first unfilled field.
4. **Next field** jumps / Form list tap opens input.
5. After save → auto-advance.
6. When none remain → Submit / Sign.

## 2. Local Mark → Lenore prove

**Status: DONE on deployed `app.seal.nyc` (2026-09-29).**

Doc `c3a0968c-6383-4085-a133-aef769224e44` · status `completed` · both signers
via email OTP + Seal account + Fields Form View + sealed PDF copies in inbox.

1. [x] Deployed `app.seal.nyc` includes SEA-86 + next-field (`index-puNEg4Iy.js`)
2. [x] Upload packet PDF
3. [x] Signature + date fields for Mark and Lenore
4. [x] Both **Signer** + **email OTP**
5. [x] Send → both get invite mail
6. [x] **Mark**: OTP → account → START → privacy → ESIGN → Fields → sign → submit
7. [x] **Lenore** same
8. [x] Completion / signed-copy mail with sealed PDF for both signers
9. [x] Document view toggle still works alongside Fields

Family / in-law packets are clear to send.

---

## 3. Solo click budget

≤6 intentional clicks after auth: upload → accept fields → adopt signature (once) → sign → done + sealed inbox.

---

## 4. Non-goals

- DocuSeal AGPL copy
- Fat DocuSign chrome
- Review-matrix SPA
