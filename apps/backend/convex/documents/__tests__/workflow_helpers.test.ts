import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import type { DocumentWorkflowStatus } from "../../schemas/document_workflow_status";
import { createTestContext } from "../../test.setup";
import {
  canCancelDocument,
  canCompleteDocument,
  canSendDocument,
  isTerminalWorkflowStatus,
  transitionWorkflowStatus,
  verifyDocumentOwnership,
} from "../workflow_helpers";

// ─── Pure function tests ────────────────────────────────────────────

describe("isTerminalWorkflowStatus", () => {
  test.each<[DocumentWorkflowStatus, boolean]>([
    ["completed", true],
    ["cancelled", true],
    ["declined", true],
    ["expired", true],
    ["draft", false],
    ["sent", false],
    ["in_progress", false],
    ["waiting_for_payment", false],
  ])("returns %s for status '%s'", (status, expected) => {
    expect(isTerminalWorkflowStatus(status)).toBe(expected);
  });
});

describe("canSendDocument", () => {
  test("returns true for draft", () => {
    expect(canSendDocument("draft")).toBe(true);
  });

  test.each<DocumentWorkflowStatus>([
    "sent",
    "in_progress",
    "waiting_for_payment",
    "completed",
    "cancelled",
    "declined",
    "expired",
  ])("returns false for '%s'", (status) => {
    expect(canSendDocument(status)).toBe(false);
  });
});

describe("canCancelDocument", () => {
  test.each<DocumentWorkflowStatus>(["draft", "sent", "in_progress", "waiting_for_payment"])(
    "returns true for '%s'",
    (status) => {
      expect(canCancelDocument(status)).toBe(true);
    },
  );

  test.each<DocumentWorkflowStatus>(["completed", "cancelled", "declined", "expired"])(
    "returns false for terminal status '%s'",
    (status) => {
      expect(canCancelDocument(status)).toBe(false);
    },
  );
});

describe("canCompleteDocument", () => {
  test.each<DocumentWorkflowStatus>(["in_progress", "waiting_for_payment"])(
    "returns true for '%s'",
    (status) => {
      expect(canCompleteDocument(status)).toBe(true);
    },
  );

  test.each<DocumentWorkflowStatus>(["draft", "sent", "completed", "cancelled", "declined", "expired"])(
    "returns false for '%s'",
    (status) => {
      expect(canCompleteDocument(status)).toBe(false);
    },
  );
});

// ─── DB-dependent tests ─────────────────────────────────────────────

describe("transitionWorkflowStatus", () => {
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
        clerkId: "clerk_test_owner",
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
        workflowStatus: "draft",
      });
    });
  });

  test("draft -> sent sets sentAt timestamp", async () => {
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "sent");
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(doc!.workflowStatus).toBe("sent");
    expect(doc!.sentAt).toBeTypeOf("number");
  });

  test("in_progress -> completed sets completedAt timestamp", async () => {
    // Transition to sent first, then in_progress
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "sent");
    });
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "in_progress");
    });
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "completed");
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(doc!.workflowStatus).toBe("completed");
    expect(doc!.completedAt).toBeTypeOf("number");
  });

  test("invalid transition draft -> completed throws ConvexError", async () => {
    await expect(
      t.run(async (ctx) => {
        await transitionWorkflowStatus(ctx, documentId, "completed");
      }),
    ).rejects.toThrow("Invalid workflow transition from draft to completed");
  });

  test("sent -> expired sets expiredAt timestamp", async () => {
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "sent");
    });
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "expired");
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(doc!.workflowStatus).toBe("expired");
    expect(doc!.expiredAt).toBeTypeOf("number");
  });

  test("expired -> sent re-enables document (re-send flow)", async () => {
    // Transition draft -> sent -> expired
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "sent");
    });
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "expired");
    });

    // Re-send: expired -> sent
    await t.run(async (ctx) => {
      await transitionWorkflowStatus(ctx, documentId, "sent");
    });

    const doc = await t.run(async (ctx) => {
      return await ctx.db.get(documentId);
    });

    expect(doc).not.toBeNull();
    expect(doc!.workflowStatus).toBe("sent");
    expect(doc!.sentAt).toBeTypeOf("number");
  });

  test("non-existent document throws 'Document not found'", async () => {
    // Use a fake document ID by re-using ownerId (valid Id format, wrong table semantics)
    const fakeDocumentId = "nonexistent" as Id<"documents">;

    await expect(
      t.run(async (ctx) => {
        await transitionWorkflowStatus(ctx, fakeDocumentId, "sent");
      }),
    ).rejects.toThrow("Document not found");
  });
});

describe("verifyDocumentOwnership", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;
  let otherUserId: Id<"users">;
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
        clerkId: "clerk_test_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "other@test.com",
        name: "Other User",
        clerkId: "clerk_test_other",
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
        workflowStatus: "draft",
      });
    });
  });

  test("does not throw when user is the document owner", async () => {
    await expect(
      t.run(async (ctx) => {
        await verifyDocumentOwnership(ctx, documentId, ownerId);
      }),
    ).resolves.not.toThrow();
  });

  test("throws when user is not the document owner", async () => {
    await expect(
      t.run(async (ctx) => {
        await verifyDocumentOwnership(ctx, documentId, otherUserId);
      }),
    ).rejects.toThrow("Only the document owner can modify the workflow status");
  });

  test("throws 'Document not found' for non-existent document", async () => {
    const fakeDocumentId = "nonexistent" as Id<"documents">;

    await expect(
      t.run(async (ctx) => {
        await verifyDocumentOwnership(ctx, fakeDocumentId, ownerId);
      }),
    ).rejects.toThrow("Document not found");
  });
});
