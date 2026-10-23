import { eq } from "drizzle-orm";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import {
  auditHealth,
  member,
  organization,
  user,
} from "../global/schema.js";
import {
  AUDIT_FAILURE_ALERT_THRESHOLD,
  listAuditHealthAlertCandidates,
  listOrganizationAdminEmails,
  markAuditHealthAlerted,
  recordAuditWriteFailure,
  recordAuditWriteSuccess,
} from "./audit-health.js";

describe("audit health (SEA-56)", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(auditHealth);
    await db.delete(member);
    await db.delete(user);
    await db.delete(organization);
  });

  it("counts consecutive failures and clears on success", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_health",
      name: "Health Org",
      slug: "health-org",
    });

    expect(await recordAuditWriteFailure(db, "org_health", "boom-1")).toBe(1);
    expect(await recordAuditWriteFailure(db, "org_health", "boom-2")).toBe(2);
    expect(await recordAuditWriteFailure(db, "org_health", "boom-3")).toBe(3);

    const [row] = await db
      .select()
      .from(auditHealth)
      .where(eq(auditHealth.organizationId, "org_health"));
    expect(row?.consecutiveFailures).toBe(3);
    expect(row?.lastFailureReason).toBe("boom-3");

    await recordAuditWriteSuccess(db, "org_health");
    const [cleared] = await db.select().from(auditHealth);
    expect(cleared?.consecutiveFailures).toBe(0);
  });

  it("lists alert candidates at threshold and respects cooldown", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_alert",
      name: "Alert Org",
      slug: "alert-org",
    });

    for (let i = 0; i < AUDIT_FAILURE_ALERT_THRESHOLD; i++) {
      await recordAuditWriteFailure(db, "org_alert", `fail-${i}`);
    }

    const now = new Date("2026-09-25T12:00:00.000Z");
    const candidates = await listAuditHealthAlertCandidates(db, now);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.organizationSlug).toBe("alert-org");

    await markAuditHealthAlerted(db, "org_alert", now);
    expect(await listAuditHealthAlertCandidates(db, now)).toHaveLength(0);

    const stillCool = new Date(now.getTime() + 60 * 60 * 1000);
    expect(await listAuditHealthAlertCandidates(db, stillCool)).toHaveLength(0);

    const afterCooldown = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    expect(await listAuditHealthAlertCandidates(db, afterCooldown)).toHaveLength(
      1
    );
  });

  it("resolves owner and admin emails", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_admins",
      name: "Admins Org",
      slug: "admins-org",
    });
    await db.insert(user).values([
      {
        id: "u_owner",
        name: "Owner",
        email: "owner@example.com",
      },
      {
        id: "u_member",
        name: "Member",
        email: "member@example.com",
      },
    ]);
    await db.insert(member).values([
      {
        id: "m1",
        organizationId: "org_admins",
        userId: "u_owner",
        role: "owner",
      },
      {
        id: "m2",
        organizationId: "org_admins",
        userId: "u_member",
        role: "member",
      },
    ]);

    const emails = await listOrganizationAdminEmails(db, "org_admins");
    expect(emails).toEqual([{ email: "owner@example.com", name: "Owner" }]);
  });
});
