import { describe, expect, it } from "vitest";

import {
  AUDIT_BACKUP_PREFIX,
  auditBackupObjectKey,
  BACKUP_MANIFEST_NAME,
  utcDayKey,
} from "./backup-dr.js";

describe("backup-dr (SEA-55)", () => {
  it("builds stable R2 keys under backups/audit", () => {
    expect(auditBackupObjectKey("2026-09-25", BACKUP_MANIFEST_NAME)).toBe(
      `${AUDIT_BACKUP_PREFIX}/2026-09-25/${BACKUP_MANIFEST_NAME}`
    );
  });

  it("formats UTC day keys as YYYY-MM-DD", () => {
    expect(utcDayKey(new Date("2026-09-25T15:04:05.000Z"))).toBe("2026-09-25");
  });
});
