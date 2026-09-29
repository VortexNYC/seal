# Classic self-serve e-sign UX — active spec

**Status:** active · **Audience:** humans who use Seal's classic UI themselves.

**Sources:** Documenso + **DocuSeal** OSS (design reference only — no AGPL /
proprietary copy). Founder checklist 2026-09-28.

**Gate:** Do not send real family / in-law packets until §2 Mark→Lenore prove
is green on the **deployed** build.

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
| SEA-86 mobile Form View              | **landing** (this PR)                |
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

**Status: NOT DONE until checked off on deployed build.**

1. Deployed `app.seal.nyc` (or preview) includes SEA-86 + next-field
2. Upload packet PDF
3. Accept all / place signature + date for Mark and Lenore
4. Both **Signer** + **email OTP**
5. Send → both get invite mail
6. **Mark** on phone (portrait): OTP → account (exact email) → START → privacy → ESIGN → Fields list → sign → submit
7. **Lenore** same
8. Completion mail with sealed PDF for both + sender
9. Spot-check desktop Document view still works

Until 6–9 are green on the deployed build, **do not send the real family packet.**

---

## 3. Solo click budget

≤6 intentional clicks after auth: upload → accept fields → adopt signature (once) → sign → done + sealed inbox.

---

## 4. Non-goals

- DocuSeal AGPL copy
- Fat DocuSign chrome
- Review-matrix SPA
