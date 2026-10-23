import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import { auditChainTips, auditLogs, organization } from "../global/schema.js";
import {
  AUDIT_BACKUP_PREFIX,
  BACKUP_MANIFEST_NAME,
  buildAuditBackupManifest,
  writeDailyAuditBackup,
} from "./backup-dr.js";

describe("writeDailyAuditBackup (SEA-55)", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(auditLogs);
    await db.delete(auditChainTips);
    await db.delete(organization);
  });

  it("writes a JSON manifest of audit chain tips to R2", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_backup",
      name: "Backup Org",
      slug: "backup-org",
    });
    await db.insert(auditChainTips).values({
      organizationId: "org_backup",
      tipHash: "sha256:tip-1",
      sequence: 3,
      updatedAt: new Date(),
    });

    const now = new Date("2026-09-25T12:00:00.000Z");
    const result = await writeDailyAuditBackup(env, now);
    expect(result.success).toBe(true);
    expect(result.key).toBe(
      `${AUDIT_BACKUP_PREFIX}/2026-09-25/${BACKUP_MANIFEST_NAME}`
    );
    expect(result.tipCount).toBe(1);

    const object = await env.DOCUMENTS_BUCKET.get(result.key);
    expect(object).not.toBeNull();
    const parsed = JSON.parse((await object!.text()) as string) as {
      kind: string;
      tipCount: number;
      tips: Array<{ organizationId: string; tipHash: string; sequence: number }>;
    };
    expect(parsed.kind).toBe("seal-audit-chain-tips");
    expect(parsed.tipCount).toBe(1);
    expect(parsed.tips[0]?.organizationId).toBe("org_backup");
    expect(parsed.tips[0]?.tipHash).toBe("sha256:tip-1");
    expect(parsed.tips[0]?.sequence).toBe(3);

    const manifest = await buildAuditBackupManifest(env, now);
    expect(manifest.tips).toHaveLength(1);
  });
});
