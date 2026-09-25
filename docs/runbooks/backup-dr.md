# Backup & disaster recovery (SEA-55)

CompAI `fnd_6ab563f6c6010aa7fade2e30` — backup/DR for signed documents and audit.

## What is protected

| Asset | Store | Recovery primitive |
| --- | --- | --- |
| Envelopes, recipients, sealed `audit_logs`, tips | D1 `seal-global` | [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) (30-day window) |
| PDFs, certificates, attachments | R2 `seal-documents` | R2 bucket locks (7-year retention) + object immutability against delete/overwrite during lock |
| Audit tip snapshots | R2 `backups/audit/{YYYY-MM-DD}/manifest.json` | Daily Worker cron export (SEA-55) |

## Production controls (applied)

R2 bucket locks on `seal-documents`:

- `all-objects-7y` — all prefixes, retain **2555 days** (~7 years)
- `certificates-7y` — `certificates/` prefix, 2555 days (belt)
- `backups-90d` — `backups/` prefix, 90 days (manifest rotation floor; all-objects-7y still applies)

Verify:

```bash
cd apps/api
pnpm exec wrangler r2 bucket lock list seal-documents
```

## Daily audit tip backup

The 09:00 UTC scheduled Worker (`runScheduledTasks` → `writeDailyAuditBackup`) writes:

```text
backups/audit/{YYYY-MM-DD}/manifest.json
```

Contents: every org's `audit_chain_tips` row (tip hash + sequence) plus document count. This is offline evidence that the sealed chain tip existed that day — not a full DB dump (Time Travel covers PITR).

## D1 restore (break-glass)

See also: [break-glass data access](./break-glass-data-access.md) (SEA-68) for
R2 document reads. D1 Time Travel restore:

1. Capture current bookmark (do this before restore):

```bash
cd apps/api
pnpm exec wrangler d1 time-travel info seal-global --env production
```

2. Restore to a bookmark or timestamp (creates a new database; cutover is manual):

```bash
pnpm exec wrangler d1 time-travel restore seal-global \
  --bookmark=<BOOKMARK> \
  --env production
```

Or:

```bash
pnpm exec wrangler d1 time-travel restore seal-global \
  --timestamp=2026-09-24T12:00:00Z \
  --env production
```

3. Point `wrangler.toml` / dashboard binding at the restored DB id only after verifying chain health:

```bash
# After Worker points at restored D1
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API/api/v1/organizations/$SLUG/audit/verify"
```

## R2 object recovery

Locked objects cannot be deleted or overwritten until the retention window ends. If an object is corrupted *before* lock enforcement or outside lock scope, recover from:

1. Prior object version if bucket versioning is enabled in the dashboard (optional add-on).
2. Application-level re-upload of the source PDF from the sender.
3. Certificate of Completion regenerate path (`generateAndStoreCertificateOfCompletion`) when the envelope is still `completed` in D1.

## Prove

```bash
pnpm run prove:backup-dr
```

Expect: R2 locks present, latest `backups/audit/*/manifest.json` readable (or cron not yet run — warn only within 36h of deploy).
