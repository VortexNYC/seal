/**
 * Backup / DR for signed docs + audit (SEA-55).
 * CompAI fnd_6ab563f6c6010aa7fade2e30.
 *
 * Native stack:
 * - D1 Time Travel for the seal-global database (audit + envelopes)
 * - R2 bucket locks on seal-documents (7y retention)
 * - Daily audit tip snapshot to R2 `backups/audit/{date}/` as offline evidence
 */

import { createD1 } from "../global/db.js";
import { auditChainTips, documents } from "../global/schema.js";

export const AUDIT_BACKUP_PREFIX = "backups/audit";
export const BACKUP_MANIFEST_NAME = "manifest.json";

export type AuditBackupManifest = {
  version: 1;
  kind: "seal-audit-chain-tips";
  createdAt: string;
  createdAtMs: number;
  tipCount: number;
  documentCount: number;
  tips: Array<{
    organizationId: string;
    tipHash: string;
    sequence: number;
    updatedAt: number | null;
  }>;
};

export function auditBackupObjectKey(day: string, name: string): string {
  return `${AUDIT_BACKUP_PREFIX}/${day}/${name}`;
}

export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function buildAuditBackupManifest(
  env: Pick<CloudflareBindings, "D1">,
  now: Date = new Date()
): Promise<AuditBackupManifest> {
  const db = createD1(env.D1);
  const tips = await db.select().from(auditChainTips);
  const docs = await db.select({ id: documents.id }).from(documents);

  return {
    version: 1,
    kind: "seal-audit-chain-tips",
    createdAt: now.toISOString(),
    createdAtMs: now.getTime(),
    tipCount: tips.length,
    documentCount: docs.length,
    tips: tips.map((t) => ({
      organizationId: t.organizationId,
      tipHash: t.tipHash,
      sequence: t.sequence,
      updatedAt: t.updatedAt?.getTime() ?? null,
    })),
  };
}

export type AuditBackupResult = {
  success: boolean;
  key: string;
  tipCount: number;
  documentCount: number;
  error?: string;
};

export async function writeDailyAuditBackup(
  env: Pick<CloudflareBindings, "D1" | "DOCUMENTS_BUCKET">,
  now: Date = new Date()
): Promise<AuditBackupResult> {
  const bucket = env.DOCUMENTS_BUCKET;
  if (!bucket) {
    return {
      success: false,
      key: "",
      tipCount: 0,
      documentCount: 0,
      error: "DOCUMENTS_BUCKET not configured",
    };
  }

  const day = utcDayKey(now);
  const key = auditBackupObjectKey(day, BACKUP_MANIFEST_NAME);
  const manifest = await buildAuditBackupManifest(env, now);
  const body = JSON.stringify(manifest);

  try {
    await bucket.put(key, body, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: {
        kind: manifest.kind,
        tipCount: String(manifest.tipCount),
        documentCount: String(manifest.documentCount),
        createdAtMs: String(manifest.createdAtMs),
      },
    });
    return {
      success: true,
      key,
      tipCount: manifest.tipCount,
      documentCount: manifest.documentCount,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[backup-dr] audit backup put failed:", message);
    return {
      success: false,
      key,
      tipCount: manifest.tipCount,
      documentCount: manifest.documentCount,
      error: message,
    };
  }
}
