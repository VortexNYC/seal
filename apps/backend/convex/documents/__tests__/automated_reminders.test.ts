// Set before imports — expiration_alerts.ts imports email.ts which initializes Resend at module level
process.env.RESEND_API_KEY = "re_test_dummy";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("processAutomatedReminders", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Reminder Test Org",
        slug: "reminder-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@reminder-test.com",
        name: "Doc Owner",
        authSubject: "reminder_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    // Activate fake timers AFTER DB setup — fake timers replace setTimeout which
    // convex-test uses internally, causing beforeEach to hang on slow CI runners.
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Restore real timers first — finishAllScheduledFunctions can hang when
    // fake timers intercept internal setTimeout calls on slow CI runners.
    vi.useRealTimers();
  });

  function createDocument(
    overrides: Partial<{
      workflowStatus: "sent" | "in_progress";
      sentAt: number;
      status: "active" | "deleted";
    }> = {}
  ) {
    return t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        organizationId,
        ownerId,
        name: "Test Contract",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "test-storage-id",
        sharingMode: "private",
        status: overrides.status ?? "active",
        workflowStatus: overrides.workflowStatus ?? "sent",
        sentAt: overrides.sentAt ?? Date.now() - 5 * DAY_MS, // Sent 5 days ago
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  }

  function createRecipient(
    documentId: Id<"documents">,
    status: "pending" | "viewed" | "signed"
  ) {
    return t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "signer@example.com",
        name: "Test Signer",
        role: "signer",
        status,
        signingToken: `tok_${Math.random().toString(36).slice(2)}`,
        tokenExpiresAt: Date.now() + 30 * DAY_MS,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  }

  test("schedules reminders for pending recipients at due intervals", async () => {
    // Document sent 5 days ago — with default schedule [3, 7, 14], intervals 3 is due
    const docId = await createDocument({ sentAt: Date.now() - 5 * DAY_MS });
    await createRecipient(docId, "pending");

    const result = await t.mutation(
      internal.documents.automated_reminders.processAutomatedReminders,
      {}
    );

    expect(result.remindersScheduled).toBe(1);

    // Verify a reminder record was created
    const reminders = await t.run(async (ctx) => {
      return await ctx.db
        .query("document_reminders")
        .withIndex("by_document", (q) => q.eq("documentId", docId))
        .collect();
    });

    expect(reminders).toHaveLength(1);
    expect(reminders[0].type).toBe("automated");
    expect(reminders[0].status).toBe("pending");
  });

  test("schedules multiple reminders for multiple due intervals", async () => {
    // Sent 10 days ago — intervals 3 and 7 are both due (default [3, 7, 14])
    const docId = await createDocument({ sentAt: Date.now() - 10 * DAY_MS });
    await createRecipient(docId, "pending");

    const result = await t.mutation(
      internal.documents.automated_reminders.processAutomatedReminders,
      {}
    );

    expect(result.remindersScheduled).toBe(2);
  });

  test("does not schedule reminders for signed recipients", async () => {
    const docId = await createDocument();
    await createRecipient(docId, "signed");

    const result = await t.mutation(
      internal.documents.automated_reminders.processAutomatedReminders,
      {}
    );

    expect(result.remindersScheduled).toBe(0);
  });

  test("does not schedule reminders for deleted documents", async () => {
    const docId = await createDocument({ status: "deleted" });
    await createRecipient(docId, "pending");

    const result = await t.mutation(
      internal.documents.automated_reminders.processAutomatedReminders,
      {}
    );

    expect(result.remindersScheduled).toBe(0);
  });

  test("skips already-sent reminders (dedup)", async () => {
    const docId = await createDocument({ sentAt: Date.now() - 5 * DAY_MS });
    const recipientId = await createRecipient(docId, "pending");

    // Pre-create a reminder for the 3-day interval
    const sentAt = Date.now() - 5 * DAY_MS;
    const intervalTarget = sentAt + 3 * DAY_MS;
    await t.run(async (ctx) => {
      await ctx.db.insert("document_reminders", {
        documentId: docId,
        recipientId,
        type: "automated",
        status: "sent",
        scheduledFor: intervalTarget,
        createdBy: ownerId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const result = await t.mutation(
      internal.documents.automated_reminders.processAutomatedReminders,
      {}
    );

    // Should not re-schedule for the 3-day interval
    expect(result.remindersScheduled).toBe(0);
  });

  test("uses org custom reminder schedule if set", async () => {
    // Set custom schedule: only remind at day 1
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        notificationSettings: {
          reminderSchedule: [1],
          expirationAlertDays: 3,
          sendCompletionEmail: true,
          sendViewedNotification: true,
        },
      });
    });

    // Document sent 2 days ago — interval 1 is due
    const docId = await createDocument({ sentAt: Date.now() - 2 * DAY_MS });
    await createRecipient(docId, "pending");

    const result = await t.mutation(
      internal.documents.automated_reminders.processAutomatedReminders,
      {}
    );

    expect(result.remindersScheduled).toBe(1);
  });

  test("processes in_progress documents too", async () => {
    const docId = await createDocument({
      workflowStatus: "in_progress",
      sentAt: Date.now() - 5 * DAY_MS,
    });
    await createRecipient(docId, "viewed");

    const result = await t.mutation(
      internal.documents.automated_reminders.processAutomatedReminders,
      {}
    );

    // "viewed" recipients should get reminders too
    expect(result.remindersScheduled).toBeGreaterThan(0);
  });
});

describe("getDocumentsApproachingDeadline", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Expiration Test Org",
        slug: "expiration-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@expiration-test.com",
        name: "Doc Owner",
        authSubject: "expiration_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  test("returns documents within the alert window", async () => {
    // Deadline in 2 days (default expirationAlertDays = 3)
    await t.run(async (ctx) => {
      await ctx.db.insert("documents", {
        organizationId,
        ownerId,
        name: "Expiring Doc",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "test-storage-id",
        sharingMode: "private",
        status: "active",
        workflowStatus: "sent",
        deadline: Date.now() + 2 * DAY_MS,
        sentAt: Date.now() - 5 * DAY_MS,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline,
      {}
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].documentName).toBe("Expiring Doc");
    expect(candidates[0].daysRemaining).toBe(2);
  });

  test("excludes documents outside the alert window", async () => {
    // Deadline in 10 days (outside default 3-day window)
    await t.run(async (ctx) => {
      await ctx.db.insert("documents", {
        organizationId,
        ownerId,
        name: "Far Future Doc",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "test-storage-id",
        sharingMode: "private",
        status: "active",
        workflowStatus: "sent",
        deadline: Date.now() + 10 * DAY_MS,
        sentAt: Date.now() - 1 * DAY_MS,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline,
      {}
    );

    expect(candidates).toHaveLength(0);
  });

  test("excludes already-alerted days", async () => {
    await t.run(async (ctx) => {
      await ctx.db.insert("documents", {
        organizationId,
        ownerId,
        name: "Already Alerted Doc",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "test-storage-id",
        sharingMode: "private",
        status: "active",
        workflowStatus: "sent",
        deadline: Date.now() + 2 * DAY_MS,
        sentAt: Date.now() - 5 * DAY_MS,
        expirationAlertsSent: [2], // Already alerted for 2 days remaining
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline,
      {}
    );

    expect(candidates).toHaveLength(0);
  });

  test("excludes past-deadline documents", async () => {
    // Deadline was yesterday
    await t.run(async (ctx) => {
      await ctx.db.insert("documents", {
        organizationId,
        ownerId,
        name: "Expired Doc",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "test-storage-id",
        sharingMode: "private",
        status: "active",
        workflowStatus: "sent",
        deadline: Date.now() - 1 * DAY_MS,
        sentAt: Date.now() - 10 * DAY_MS,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline,
      {}
    );

    expect(candidates).toHaveLength(0);
  });

  test("uses custom expirationAlertDays from org settings", async () => {
    // Expand alert window to 7 days
    await t.run(async (ctx) => {
      await ctx.db.patch(organizationId, {
        notificationSettings: {
          reminderSchedule: [3, 7, 14],
          expirationAlertDays: 7,
          sendCompletionEmail: true,
          sendViewedNotification: true,
        },
      });
    });

    // Deadline in 5 days — within 7-day window but outside default 3-day
    await t.run(async (ctx) => {
      await ctx.db.insert("documents", {
        organizationId,
        ownerId,
        name: "Custom Window Doc",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "test-storage-id",
        sharingMode: "private",
        status: "active",
        workflowStatus: "sent",
        deadline: Date.now() + 5 * DAY_MS,
        sentAt: Date.now() - 3 * DAY_MS,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const candidates = await t.query(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline,
      {}
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].daysRemaining).toBe(5);
  });
});
