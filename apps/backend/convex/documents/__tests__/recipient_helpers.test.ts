import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { generateStringHash } from "../../crypto/helpers";
import { createTestContext } from "../../test.setup";
import {
  areAllRecipientsComplete,
  findRecipientByToken,
  getRecipientCounts,
  hasAnyRecipientDeclined,
  verifyDocumentOwnership,
} from "../recipient_helpers";

describe("recipient_helpers", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
  let ownerId: Id<"users">;

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
      });
    });
  });

  describe("verifyDocumentOwnership", () => {
    test("does not throw when user is the document owner", async () => {
      await expect(
        t.run(async (ctx) => {
          await verifyDocumentOwnership(ctx, documentId, ownerId);
        }),
      ).resolves.toBeNull();
    });

    test("throws when user is not the document owner", async () => {
      const otherUserId = await t.run(async (ctx) => {
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

      await expect(
        t.run(async (ctx) => {
          await verifyDocumentOwnership(ctx, documentId, otherUserId);
        }),
      ).rejects.toThrow("Only the document owner can perform this action");
    });

    test("throws when document does not exist", async () => {
      // Use a fabricated document ID that doesn't exist
      const fakeDocumentId = "k17abc123def456gh" as Id<"documents">;

      await expect(
        t.run(async (ctx) => {
          await verifyDocumentOwnership(ctx, fakeDocumentId, ownerId);
        }),
      ).rejects.toThrow("Document not found");
    });
  });

  describe("findRecipientByToken", () => {
    test("finds recipient by tokenHash (hash-based lookup)", async () => {
      const token = "token-hash-lookup";
      const tokenHash = await generateStringHash(token);

      const recipientId = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@test.com",
          name: "Signer",
          role: "signer",
          status: "pending",
          order: 1,
          signingToken: token,
          tokenHash,
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return await findRecipientByToken(ctx, token);
      });

      expect(result).not.toBeNull();
      expect(result?._id).toEqual(recipientId);
      expect(result?.email).toBe("signer@test.com");
    });

    test("returns null when tokenHash is not set", async () => {
      const token = "token-plaintext-fallback";

      await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "fallback@test.com",
          name: "Fallback Signer",
          role: "signer",
          status: "pending",
          order: 1,
          signingToken: token,
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return await findRecipientByToken(ctx, token);
      });

      expect(result).toBeNull();
    });

    test("returns null for non-existent token", async () => {
      const result = await t.run(async (ctx) => {
        return await findRecipientByToken(ctx, "non-existent-token");
      });

      expect(result).toBeNull();
    });
  });

  describe("areAllRecipientsComplete", () => {
    test("returns true when all recipients are complete", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@test.com",
          name: "Signer",
          role: "signer",
          status: "signed",
          order: 1,
          signingToken: "token-signer",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert("document_recipients", {
          documentId,
          email: "viewer@test.com",
          name: "Viewer",
          role: "viewer",
          status: "viewed",
          order: 2,
          signingToken: "token-viewer",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return await areAllRecipientsComplete(ctx, documentId);
      });

      expect(result).toBe(true);
    });

    test("returns false when a signer is still pending", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer-done@test.com",
          name: "Completed Signer",
          role: "signer",
          status: "signed",
          order: 1,
          signingToken: "token-done",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer-pending@test.com",
          name: "Pending Signer",
          role: "signer",
          status: "pending",
          order: 2,
          signingToken: "token-pending",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return await areAllRecipientsComplete(ctx, documentId);
      });

      expect(result).toBe(false);
    });

    test("returns false when there are no recipients", async () => {
      const result = await t.run(async (ctx) => {
        return await areAllRecipientsComplete(ctx, documentId);
      });

      expect(result).toBe(false);
    });
  });

  describe("hasAnyRecipientDeclined", () => {
    test("returns true when a recipient has declined", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@test.com",
          name: "Signer",
          role: "signer",
          status: "signed",
          order: 1,
          signingToken: "token-signed",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        await ctx.db.insert("document_recipients", {
          documentId,
          email: "decliner@test.com",
          name: "Decliner",
          role: "signer",
          status: "declined",
          order: 2,
          signingToken: "token-declined",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return await hasAnyRecipientDeclined(ctx, documentId);
      });

      expect(result).toBe(true);
    });

    test("returns false when no recipients have declined", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer@test.com",
          name: "Signer",
          role: "signer",
          status: "pending",
          order: 1,
          signingToken: "token-pending",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.run(async (ctx) => {
        return await hasAnyRecipientDeclined(ctx, documentId);
      });

      expect(result).toBe(false);
    });
  });

  describe("getRecipientCounts", () => {
    test("returns correct counts per role", async () => {
      await t.run(async (ctx) => {
        // 2 signers
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer1@test.com",
          name: "Signer 1",
          role: "signer",
          status: "pending",
          order: 1,
          signingToken: "token-s1",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer2@test.com",
          name: "Signer 2",
          role: "signer",
          status: "pending",
          order: 2,
          signingToken: "token-s2",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // 1 viewer
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "viewer@test.com",
          name: "Viewer",
          role: "viewer",
          status: "pending",
          order: 3,
          signingToken: "token-v1",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // 1 approver
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "approver@test.com",
          name: "Approver",
          role: "approver",
          status: "pending",
          order: 4,
          signingToken: "token-a1",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const counts = await t.run(async (ctx) => {
        return await getRecipientCounts(ctx, documentId);
      });

      expect(counts).toEqual({
        total: 4,
        signers: 2,
        viewers: 1,
        approvers: 1,
      });
    });
  });
});
