import { eq } from "drizzle-orm";
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import { auditChainTips, auditLogs, organization } from "../global/schema.js";
import {
  AUDIT_GENESIS_HASH,
  canonicalizeAuditPayload,
  computeAuditEntryHash,
  verifyAuditChain,
} from "./audit-chain.js";
import { writeAuditLog } from "./audit-log.js";

describe("audit hash chain (SEA-44)", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(auditLogs);
    await db.delete(auditChainTips);
    await db.delete(organization);
  });

  it("canonicalizes with stable key order", () => {
    const json = canonicalizeAuditPayload({
      id: "a",
      organizationId: "o",
      actorId: "u",
      actorType: "user",
      action: "x",
      resourceType: "document",
      resourceId: null,
      metadata: null,
      ipAddress: null,
      userAgent: null,
      createdAtMs: 1,
    });
    expect(json).toBe(
      '{"id":"a","organizationId":"o","actorId":"u","actorType":"user","action":"x","resourceType":"document","resourceId":null,"metadata":null,"ipAddress":null,"userAgent":null,"createdAtMs":1}'
    );
  });

  it("chains writes from genesis and verifies", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_chain",
      name: "Chain Org",
      slug: "chain-org",
    });

    const first = await writeAuditLog(db, {
      organizationId: "org_chain",
      actor: { type: "user", id: "u1" },
      action: "document.created",
      resourceType: "document",
      resourceId: "d1",
      createdAt: new Date(1_700_000_000_000),
    });
    expect(first.prevHash).toBe(AUDIT_GENESIS_HASH);
    expect(first.sequence).toBe(1);

    const second = await writeAuditLog(db, {
      organizationId: "org_chain",
      actor: { type: "user", id: "u1" },
      action: "document.sent",
      resourceType: "document",
      resourceId: "d1",
      createdAt: new Date(1_700_000_000_100),
    });
    expect(second.prevHash).toBe(first.entryHash);
    expect(second.sequence).toBe(2);

    const verified = await verifyAuditChain(db, "org_chain");
    expect(verified.ok).toBe(true);
    expect(verified.checked).toBe(2);
    expect(verified.tipHash).toBe(second.entryHash);
    expect(verified.tipSequence).toBe(2);
  });

  it("detects tampered sealed rows", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_tamper",
      name: "Tamper Org",
      slug: "tamper-org",
    });

    const written = await writeAuditLog(db, {
      organizationId: "org_tamper",
      actor: { type: "user", id: "u1" },
      action: "document.created",
      resourceType: "document",
      resourceId: "d1",
      createdAt: new Date(1_700_000_001_000),
    });

    await db
      .update(auditLogs)
      .set({ action: "document.hacked" })
      .where(eq(auditLogs.id, written.values.id));

    const verified = await verifyAuditChain(db, "org_tamper");
    expect(verified.ok).toBe(false);
    expect(verified.firstBreak?.id).toBe(written.values.id);
  });

  it("skips legacy null-hash rows without breaking sealed chain", async () => {
    const db = createD1(env.D1);
    await db.insert(organization).values({
      id: "org_legacy",
      name: "Legacy Org",
      slug: "legacy-org",
    });

    await db.insert(auditLogs).values({
      id: "legacy_1",
      organizationId: "org_legacy",
      actorId: "u1",
      actorType: "user",
      action: "document.created",
      resourceType: "document",
      resourceId: "d1",
      createdAt: new Date(1_700_000_002_000),
    });

    const sealed = await writeAuditLog(db, {
      organizationId: "org_legacy",
      actor: { type: "user", id: "u1" },
      action: "document.sent",
      resourceType: "document",
      resourceId: "d1",
      createdAt: new Date(1_700_000_002_100),
    });

    expect(sealed.prevHash).toBe(AUDIT_GENESIS_HASH);

    const verified = await verifyAuditChain(db, "org_legacy");
    expect(verified.ok).toBe(true);
    expect(verified.checked).toBe(1);
  });

  it("entry hash is deterministic", async () => {
    const payload = {
      id: "id1",
      organizationId: "o",
      actorId: "a",
      actorType: "user",
      action: "x",
      resourceType: "document",
      resourceId: null,
      metadata: null,
      ipAddress: null,
      userAgent: null,
      createdAtMs: 42,
    };
    const a = await computeAuditEntryHash(AUDIT_GENESIS_HASH, payload);
    const b = await computeAuditEntryHash(AUDIT_GENESIS_HASH, payload);
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
  });
});
