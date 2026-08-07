// Set before imports — expiration_alerts.ts imports email.ts which initializes Resend at module level
process.env.RESEND_API_KEY = "re_test_dummy";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

const ONE_DAY = 24 * 60 * 60 * 1000;

describe("getDocumentsApproachingDeadline", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;

  function makeDocument(
    overrides: Partial<{
      workflowStatus:
        | "draft"
        | "sent"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "declined"
        | "expired";
      deadline: number;
      expirationAlertsSent: number[];
      status: "active" | "deleted";
    }> = {}
  ) {
    return {
      name: "Test Document",
      ownerId,
      organizationId,
      status: overrides.status ?? "active",
      sharingMode: "private" as const,
      fileSize: 1024,
      fileType: "application/pdf",
      storageId: "storage-test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workflowStatus: overrides.workflowStatus ?? "sent",
      sentAt: Date.now(),
      ...(overrides.deadline !== undefined
        ? { deadline: overrides.deadline }
        : {}),
      ...(overrides.expirationAlertsSent !== undefined
        ? { expirationAlertsSent: overrides.expirationAlertsSent }
        : {}),
    };
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Test Owner",
        authSubject: "test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns documents with deadline within alert window", async () => {
    // Document with deadline 2 days from now, default alert window is 3 days
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          deadline: Date.now() + 2 * ONE_DAY,
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].daysRemaining).toBe(2);
  });

  test("does NOT return documents with deadline beyond alert window", async () => {
    // Document with deadline 10 days from now, default alert window is 3 days
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          deadline: Date.now() + 10 * ONE_DAY,
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(0);
  });

  test("does NOT return documents with past deadline", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          deadline: Date.now() - ONE_DAY,
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(0);
  });

  test("does NOT return documents already alerted for this day count", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          deadline: Date.now() + 2 * ONE_DAY,
          expirationAlertsSent: [2], // Already alerted at 2 days
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(0);
  });

  test("returns documents alerted at different day count", async () => {
    // Alerted at 3 days, now at 2 days — should alert again
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          deadline: Date.now() + 2 * ONE_DAY,
          expirationAlertsSent: [3],
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].daysRemaining).toBe(2);
  });

  test("does NOT return draft or expired documents", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          workflowStatus: "draft",
          deadline: Date.now() + 2 * ONE_DAY,
        })
      );
      await ctx.db.insert(
        "documents",
        makeDocument({
          workflowStatus: "expired",
          deadline: Date.now() + 2 * ONE_DAY,
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(0);
  });

  test("returns in_progress documents approaching deadline", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          workflowStatus: "in_progress",
          deadline: Date.now() + 1 * ONE_DAY,
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(1);
  });

  test("does NOT return deleted documents", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          status: "deleted",
          deadline: Date.now() + 2 * ONE_DAY,
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(0);
  });

  test("respects org expirationAlertDays setting", async () => {
    // Set org alert window to 7 days
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        notificationSettings: {
          expirationAlertDays: 7,
          reminderSchedule: [3, 7, 14],
          sendCompletionEmail: true,
          sendViewedNotification: true,
        },
      });
    });

    // Document 5 days out — beyond default 3 but within custom 7
    await t.run(async (ctx) => {
      await ctx.db.insert(
        "documents",
        makeDocument({
          deadline: Date.now() + 5 * ONE_DAY,
        })
      );
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].daysRemaining).toBe(5);
  });

  test("does NOT return documents without a deadline", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("documents", makeDocument()); // no deadline
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline
    );

    expect(candidates).toHaveLength(0);
  });
});

describe("recordExpirationAlert", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;
  let documentId: Id<"documents">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Test Owner",
        authSubject: "test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-test",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        workflowStatus: "sent",
        sentAt: Date.now(),
        deadline: Date.now() + 2 * ONE_DAY,
      });
    });
  });

  test("appends daysRemaining to expirationAlertsSent", async () => {
    await t.mutation(
      internal.documents.expiration_alerts.recordExpirationAlert,
      {
        documentId,
        alertedAt: Date.now(),
        daysRemaining: 3,
      }
    );

    const doc = await t.run(async (ctx) => ctx.db.get(documentId));
    expect(doc?.expirationAlertsSent).toEqual([3]);
  });

  test("accumulates multiple alert records", async () => {
    await t.mutation(
      internal.documents.expiration_alerts.recordExpirationAlert,
      {
        documentId,
        alertedAt: Date.now(),
        daysRemaining: 3,
      }
    );
    await t.mutation(
      internal.documents.expiration_alerts.recordExpirationAlert,
      {
        documentId,
        alertedAt: Date.now(),
        daysRemaining: 1,
      }
    );

    const doc = await t.run(async (ctx) => ctx.db.get(documentId));
    expect(doc?.expirationAlertsSent).toEqual([3, 1]);
  });
});
