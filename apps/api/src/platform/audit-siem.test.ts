import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import {
  organization,
  webhookDeliveries,
  webhooks,
} from "../global/schema.js";
import { writeAuditLog } from "./audit-log.js";
import {
  AUDIT_ENTRY_CREATED_EVENT,
  flushAuditSiemStream,
  getAuditSiemCursor,
  listAuditEntriesForExport,
} from "./audit-siem.js";
import { webhookSubscribesTo } from "./webhook-events.js";

async function seedOrg() {
  const db = createD1(env.D1);
  const orgId = crypto.randomUUID();
  await db.insert(organization).values({
    id: orgId,
    name: "SIEM Org",
    slug: `siem-org-${crypto.randomUUID().slice(0, 8)}`,
  });
  return { orgId, db };
}

async function createWebhook(
  db: ReturnType<typeof createD1>,
  {
    organizationId,
    events,
    status = "active",
  }: {
    organizationId: string;
    events: string[];
    status?: string;
  }
) {
  const id = crypto.randomUUID();
  await db.insert(webhooks).values({
    id,
    publicId: crypto.randomUUID(),
    organizationId,
    name: "SIEM hook",
    url: "https://example.com/siem",
    events: JSON.stringify(events),
    secret: "siem-secret",
    status,
  });
  return id;
}

describe("audit SIEM stream (SEA-67)", () => {
  it("matches audit.* and * subscriptions", () => {
    expect(
      webhookSubscribesTo(["audit.*"], AUDIT_ENTRY_CREATED_EVENT)
    ).toBe(true);
    expect(webhookSubscribesTo(["*"], AUDIT_ENTRY_CREATED_EVENT)).toBe(true);
    expect(
      webhookSubscribesTo(["audit.entry.created"], AUDIT_ENTRY_CREATED_EVENT)
    ).toBe(true);
    expect(
      webhookSubscribesTo(["document.sent"], AUDIT_ENTRY_CREATED_EVENT)
    ).toBe(false);
  });

  it("enqueues audit.entry.created for sealed rows past the cursor", async () => {
    const { orgId, db } = await seedOrg();
    await createWebhook(db, {
      organizationId: orgId,
      events: ["audit.*"],
    });

    const first = await writeAuditLog(db, {
      organizationId: orgId,
      actor: { type: "user", id: "user_1" },
      action: "member.invited",
      resourceType: "member",
      resourceId: "mem_1",
      ipAddress: "203.0.113.10",
    });
    const second = await writeAuditLog(db, {
      organizationId: orgId,
      actor: { type: "api_token", id: "tok_1" },
      action: "settings.update",
      resourceType: "organization",
      resourceId: orgId,
    });

    const result = await flushAuditSiemStream(env, {
      organizationId: orgId,
      flushImmediately: false,
    });

    expect(result.entriesEnqueued).toBe(2);
    expect(await getAuditSiemCursor(db, orgId)).toBe(second.sequence);

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId));

    expect(deliveries).toHaveLength(2);
    expect(deliveries.map((d) => d.eventId).sort()).toEqual(
      [first.values.id, second.values.id].sort()
    );
    expect(deliveries.every((d) => d.eventType === AUDIT_ENTRY_CREATED_EVENT)).toBe(
      true
    );

    const payload = JSON.parse(deliveries[0]?.payload ?? "{}") as {
      data: { ipAddress: string | null; sequence: number };
    };
    expect(payload.data.sequence).toBeGreaterThan(0);

    // Idempotent re-flush
    const again = await flushAuditSiemStream(env, {
      organizationId: orgId,
      flushImmediately: false,
    });
    expect(again.entriesEnqueued).toBe(0);

    const exportRows = await listAuditEntriesForExport(db, orgId, {
      afterSequence: 0,
      limit: 10,
    });
    expect(exportRows).toHaveLength(2);
    expect(exportRows[0]?.ipAddress).toBe("203.0.113.10");
  });

  it("skips orgs without an audit SIEM subscription", async () => {
    const { orgId, db } = await seedOrg();
    await createWebhook(db, {
      organizationId: orgId,
      events: ["document.sent"],
    });
    await writeAuditLog(db, {
      organizationId: orgId,
      actor: { type: "user", id: "user_2" },
      action: "document.viewed",
      resourceType: "document",
    });

    const result = await flushAuditSiemStream(env, {
      organizationId: orgId,
      flushImmediately: false,
    });
    expect(result.entriesEnqueued).toBe(0);

    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.organizationId, orgId));
    expect(deliveries).toHaveLength(0);
  });
});
