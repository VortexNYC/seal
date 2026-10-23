# Break-glass data access (SEA-68)

Who *read* the PDF matters as much as who signed it. Session/API downloads now
emit sealed `document.downloaded` rows. Human engineers must not pull customer
objects from R2/D1 with raw Wrangler without a logged reason.

## Rule

**Forbidden:** `wrangler r2 object get` / dashboard download of customer PDFs
without a prior break-glass audit entry.

**Required:** use the internal break-glass endpoint (logs first, then returns
bytes), or restore via Time Travel only under the [backup/DR runbook](./backup-dr.md).

## Logged break-glass read (R2 document bytes)

Service-binding / internal auth only (`INTERNAL_API_KEY` — same gate as other
`/internal/*` routes).

```bash
# From an allowed internal caller (service binding or authorized host)
curl -sS -X POST "$API/internal/break-glass/document-read" \
  -H "Authorization: Bearer $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -o /tmp/seal-break-glass.pdf \
  -d '{
    "organizationId": "org_…",
    "documentId": "doc_…",
    "reason": "Customer support ticket SEA-123 — verify corrupted certificate",
    "operatorEmail": "you@vortex.nyc",
    "ticketRef": "SEA-123"
  }'
```

Effects:

1. Writes sealed audit action `admin.break_glass.read` (actor
   `break-glass:{operatorEmail}`) with reason + ticket + storage key.
2. Returns the PDF bytes (`x-seal-break-glass: 1`).
3. SIEM subscribers (`audit.entry.created`) receive the sealed row on the next
   fan-out (SEA-67).

`reason` must be ≥ 12 characters. Fail closed if the document/org mismatch or
the object is missing.

## D1 break-glass

D1 Time Travel restore remains under [backup-dr.md](./backup-dr.md). Before any
prod restore:

1. Open a Pile ticket with the bookmark/timestamp and blast-radius note.
2. Capture `wrangler d1 time-travel info` output into the ticket.
3. After cutover, run `GET …/audit/verify` for affected orgs.

Do not run ad-hoc `wrangler d1 execute` SELECT dumps of customer document text
against production. Prefer API audit export / SIEM.

## What is already audited (app path)

| Path | Action / via |
| --- | --- |
| Session `GET /api/documents/…/download` | `document.downloaded` / `session-download` |
| Public signing PDF preview | `document.downloaded` / `signing-pdf-preview` |
| Public signed PDF + certificate | `document.downloaded` / signing-* |
| v1 certificate + download-file token | `document.downloaded` / v1-* |
| Internal break-glass | `admin.break_glass.read` |

## Prove

```bash
# After a break-glass call, list sealed audit for the org
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/organizations/$SLUG/audit?action=admin.break_glass.read"
```
