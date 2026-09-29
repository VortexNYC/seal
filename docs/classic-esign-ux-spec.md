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

---

## 2. Local Mark → Lenore prove

1. `pnpm run dev` (api :8787, web :5180)
2. Upload GREENMAR PDF
3. Add Signer: Mark + Lenore (your test emails)
4. Accept all field suggestions (or place sig + date_signed)
5. Send → open both `/sign/…` → draw/adopt → complete
6. Confirm sealed download in completion mail

---

## 3. Non-goals

- Copy DocuSeal AGPL / additional-terms code
- Fat DocuSign chrome
- Review-matrix SPA
