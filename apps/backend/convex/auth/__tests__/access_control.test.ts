import { ConvexError } from "convex/values";
import { beforeEach, describe, expect, test } from "vitest";

import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { seedTestOrganizationMember } from "../../testVortexAuth";
import {
  ACCESS_ERRORS,
  canManageDocument,
  checkDocumentAccess,
  filterAccessibleDocuments,
  getActiveMembership,
  getDocumentOrThrow,
  getDocumentWithAccessCheck,
  getDocumentWithManageCheck,
  requireActiveMembership,
  requireDocumentAccess,
  requireManageAccess,
  requireOwnership,
} from "../access_control";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

describe("access_control", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let ownerId: Id<"users">;
  let otherUserId: Id<"users">;
  let nonMemberUserId: Id<"users">;
  let documentId: Id<"documents">;

  const now = Date.now();

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Test Org",
        slug: "test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: now,
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@test.com",
        name: "Document Owner",
        authSubject: "owner",
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
        authSubject: "other",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    nonMemberUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "nonmember@test.com",
        name: "Non Member",
        authSubject: "nonmember",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    // Add owner and otherUser as active org members
    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: ownerId,
        organizationId,
        role: "owner",
        status: "active",
      });
      await seedTestOrganizationMember(ctx, {
        userId: otherUserId,
        organizationId,
        role: "member",
        status: "active",
      });
    });

    // Create a default document with "private" sharing mode
    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Test Document",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage_test_123",
        createdAt: now,
        updatedAt: now,
      });
    });
  });

  // ─── requireOwnership (pure function, no DB) ───────────────────────

  describe("requireOwnership", () => {
    test("does not throw when userId matches document ownerId", async () => {
      const document = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });
      expect(() => requireOwnership(ownerId, sealAssertPresent(document))).not.toThrow();
    });

    test("throws ConvexError when userId does not match ownerId", async () => {
      const document = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });
      expect(() => requireOwnership(otherUserId, sealAssertPresent(document))).toThrow(ConvexError);
    });

    test("throws with default OWNER_REQUIRED message", async () => {
      const document = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });
      try {
        requireOwnership(otherUserId, sealAssertPresent(document));
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect((error as ConvexError<string>).data).toBe(ACCESS_ERRORS.OWNER_REQUIRED);
      }
    });

    test("throws with custom error message when provided", async () => {
      const document = await t.run(async (ctx) => {
        return await ctx.db.get(documentId);
      });
      try {
        requireOwnership(otherUserId, sealAssertPresent(document), "Custom owner error");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect((error as ConvexError<string>).data).toBe("Custom owner error");
      }
    });
  });

  // ─── checkDocumentAccess ───────────────────────────────────────────

  describe("checkDocumentAccess", () => {
    test("returns owner access for document owner", async () => {
      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await checkDocumentAccess(ctx, ownerId, document);
      });

      expect(result.hasAccess).toBe(true);
      expect(result.isOwner).toBe(true);
      expect(result.isOrgMember).toBe(true);
      expect(result.isWorkspaceAccess).toBe(false);
      expect(result.isSpecificAccess).toBe(false);
    });

    test("returns no access for non-owner on private document", async () => {
      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await checkDocumentAccess(ctx, otherUserId, document);
      });

      expect(result.hasAccess).toBe(false);
      expect(result.isOwner).toBe(false);
      expect(result.isOrgMember).toBe(true);
    });

    test("returns no access for non-member user", async () => {
      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await checkDocumentAccess(ctx, nonMemberUserId, document);
      });

      expect(result.hasAccess).toBe(false);
      expect(result.isOwner).toBe(false);
      expect(result.isOrgMember).toBe(false);
    });

    describe("workspace sharing mode", () => {
      let workspaceDocId: Id<"documents">;

      beforeEach(async () => {
        workspaceDocId = await t.run(async (ctx) => {
          return await ctx.db.insert("documents", {
            name: "Workspace Document",
            ownerId,
            organizationId,
            status: "active",
            sharingMode: "workspace",
            fileSize: 2048,
            fileType: "application/pdf",
            storageId: "storage_workspace_123",
            createdAt: now,
            updatedAt: now,
          });
        });
      });

      test("grants access to active org member", async () => {
        const result = await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(workspaceDocId));
          return await checkDocumentAccess(ctx, otherUserId, document);
        });

        expect(result.hasAccess).toBe(true);
        expect(result.isWorkspaceAccess).toBe(true);
        expect(result.isOrgMember).toBe(true);
        expect(result.isOwner).toBe(false);
      });

      test("denies access to non-member", async () => {
        const result = await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(workspaceDocId));
          return await checkDocumentAccess(ctx, nonMemberUserId, document);
        });

        expect(result.hasAccess).toBe(false);
        expect(result.isOrgMember).toBe(false);
      });

      test("owner still gets owner access on workspace doc", async () => {
        const result = await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(workspaceDocId));
          return await checkDocumentAccess(ctx, ownerId, document);
        });

        expect(result.hasAccess).toBe(true);
        expect(result.isOwner).toBe(true);
        expect(result.isWorkspaceAccess).toBe(false);
      });
    });

    describe("specific sharing mode", () => {
      let specificDocId: Id<"documents">;

      beforeEach(async () => {
        specificDocId = await t.run(async (ctx) => {
          return await ctx.db.insert("documents", {
            name: "Specific Document",
            ownerId,
            organizationId,
            status: "active",
            sharingMode: "specific",
            fileSize: 3072,
            fileType: "application/pdf",
            storageId: "storage_specific_123",
            createdAt: now,
            updatedAt: now,
          });
        });
      });

      test("grants access when user has an active document_access record", async () => {
        await t.run(async (ctx) => {
          await ctx.db.insert("document_access", {
            documentId: specificDocId,
            userId: otherUserId,
            permissionLevel: "view",
            grantedBy: ownerId,
            grantedAt: now,
          });
        });

        const result = await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(specificDocId));
          return await checkDocumentAccess(ctx, otherUserId, document);
        });

        expect(result.hasAccess).toBe(true);
        expect(result.isSpecificAccess).toBe(true);
        expect(result.permissionLevel).toBe("view");
        expect(result.accessRecord).toBeDefined();
      });

      test("denies access when document_access record is revoked", async () => {
        await t.run(async (ctx) => {
          await ctx.db.insert("document_access", {
            documentId: specificDocId,
            userId: otherUserId,
            permissionLevel: "edit",
            grantedBy: ownerId,
            grantedAt: now,
            revokedAt: now + 1000,
            revokedBy: ownerId,
          });
        });

        const result = await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(specificDocId));
          return await checkDocumentAccess(ctx, otherUserId, document);
        });

        expect(result.hasAccess).toBe(false);
        expect(result.isSpecificAccess).toBe(false);
      });

      test("denies access when no document_access record exists", async () => {
        const result = await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(specificDocId));
          return await checkDocumentAccess(ctx, otherUserId, document);
        });

        expect(result.hasAccess).toBe(false);
        expect(result.isOrgMember).toBe(true);
      });

      test("denies access for non-member even with specific sharing mode", async () => {
        const result = await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(specificDocId));
          return await checkDocumentAccess(ctx, nonMemberUserId, document);
        });

        expect(result.hasAccess).toBe(false);
        expect(result.isOrgMember).toBe(false);
      });
    });

    test("denies access for inactive org member", async () => {
      const inactiveUserId = await t.run(async (ctx) => {
        const uid = await ctx.db.insert("users", {
          email: "inactive@test.com",
          name: "Inactive User",
          authSubject: "inactive",
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
          activeOrganizationId: organizationId,
        });
        await seedTestOrganizationMember(ctx, {
          userId: uid,
          organizationId,
          role: "member",
          status: "suspended",
        });
        return uid;
      });

      // Even workspace sharing should deny inactive members
      const workspaceDocId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Workspace Doc",
          ownerId,
          organizationId,
          status: "active",
          sharingMode: "workspace",
          fileSize: 1024,
          fileType: "application/pdf",
          storageId: "storage_ws",
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(workspaceDocId));
        return await checkDocumentAccess(ctx, inactiveUserId, document);
      });

      expect(result.hasAccess).toBe(false);
      expect(result.isOrgMember).toBe(false);
    });
  });

  // ─── requireDocumentAccess ─────────────────────────────────────────

  describe("requireDocumentAccess", () => {
    test("returns access result when user has access", async () => {
      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await requireDocumentAccess(ctx, ownerId, document);
      });

      expect(result.hasAccess).toBe(true);
      expect(result.isOwner).toBe(true);
    });

    test("throws ConvexError when user has no access", async () => {
      await expect(
        t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(documentId));
          return await requireDocumentAccess(ctx, otherUserId, document);
        }),
      ).rejects.toThrow(ConvexError);
    });

    test("throws with default NO_ACCESS message", async () => {
      try {
        await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(documentId));
          return await requireDocumentAccess(ctx, otherUserId, document);
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(String((error as ConvexError<string>).data)).toContain(ACCESS_ERRORS.NO_ACCESS);
      }
    });

    test("throws with custom error message when provided", async () => {
      try {
        await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(documentId));
          return await requireDocumentAccess(ctx, otherUserId, document, "Forbidden");
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(String((error as ConvexError<string>).data)).toContain("Forbidden");
      }
    });
  });

  // ─── canManageDocument ─────────────────────────────────────────────

  describe("canManageDocument", () => {
    test("returns true for document owner", async () => {
      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await canManageDocument(ctx, ownerId, document);
      });

      expect(result).toBe(true);
    });

    test("returns false for non-owner without manage permission", async () => {
      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await canManageDocument(ctx, otherUserId, document);
      });

      expect(result).toBe(false);
    });

    test("returns true for user with manage-level document_access", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_access", {
          documentId,
          userId: otherUserId,
          permissionLevel: "manage",
          grantedBy: ownerId,
          grantedAt: now,
        });
      });

      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await canManageDocument(ctx, otherUserId, document);
      });

      expect(result).toBe(true);
    });

    test("returns false for user with view-level document_access", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_access", {
          documentId,
          userId: otherUserId,
          permissionLevel: "view",
          grantedBy: ownerId,
          grantedAt: now,
        });
      });

      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await canManageDocument(ctx, otherUserId, document);
      });

      expect(result).toBe(false);
    });

    test("returns false for user with edit-level document_access", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_access", {
          documentId,
          userId: otherUserId,
          permissionLevel: "edit",
          grantedBy: ownerId,
          grantedAt: now,
        });
      });

      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await canManageDocument(ctx, otherUserId, document);
      });

      expect(result).toBe(false);
    });

    test("returns false when manage access is revoked", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_access", {
          documentId,
          userId: otherUserId,
          permissionLevel: "manage",
          grantedBy: ownerId,
          grantedAt: now,
          revokedAt: now + 1000,
          revokedBy: ownerId,
        });
      });

      const result = await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        return await canManageDocument(ctx, otherUserId, document);
      });

      expect(result).toBe(false);
    });
  });

  // ─── requireManageAccess ───────────────────────────────────────────

  describe("requireManageAccess", () => {
    test("does not throw for document owner", async () => {
      await t.run(async (ctx) => {
        const document = sealAssertPresent(await ctx.db.get(documentId));
        await requireManageAccess(ctx, ownerId, document);
      });
    });

    test("throws ConvexError for non-owner without manage permission", async () => {
      await expect(
        t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(documentId));
          await requireManageAccess(ctx, otherUserId, document);
        }),
      ).rejects.toThrow(ConvexError);
    });

    test("throws with default MANAGE_REQUIRED message", async () => {
      try {
        await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(documentId));
          await requireManageAccess(ctx, otherUserId, document);
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(String((error as ConvexError<string>).data)).toContain(
          ACCESS_ERRORS.MANAGE_REQUIRED,
        );
      }
    });

    test("throws with custom error message when provided", async () => {
      try {
        await t.run(async (ctx) => {
          const document = sealAssertPresent(await ctx.db.get(documentId));
          await requireManageAccess(ctx, otherUserId, document, "Nope");
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(String((error as ConvexError<string>).data)).toContain("Nope");
      }
    });
  });

  // ─── getActiveMembership ───────────────────────────────────────────

  describe("getActiveMembership", () => {
    test("returns membership record for active member", async () => {
      const result = await t.run(async (ctx) => {
        return await getActiveMembership(ctx, otherUserId, organizationId);
      });

      expect(result).not.toBeNull();
      expect(sealAssertPresent(result).userId).toBe(otherUserId);
      expect(sealAssertPresent(result).organizationId).toBe(organizationId);
      expect(sealAssertPresent(result).status).toBe("active");
    });

    test("returns null for non-member", async () => {
      const result = await t.run(async (ctx) => {
        return await getActiveMembership(ctx, nonMemberUserId, organizationId);
      });

      expect(result).toBeNull();
    });

    test("returns null for inactive member", async () => {
      const inactiveUserId = await t.run(async (ctx) => {
        const uid = await ctx.db.insert("users", {
          email: "suspended@test.com",
          name: "Suspended User",
          authSubject: "suspended",
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
          activeOrganizationId: organizationId,
        });
        await seedTestOrganizationMember(ctx, {
          userId: uid,
          organizationId,
          role: "member",
          status: "suspended",
        });
        return uid;
      });

      const result = await t.run(async (ctx) => {
        return await getActiveMembership(ctx, inactiveUserId, organizationId);
      });

      expect(result).toBeNull();
    });
  });

  // ─── requireActiveMembership ───────────────────────────────────────

  describe("requireActiveMembership", () => {
    test("returns membership record for active member", async () => {
      const result = await t.run(async (ctx) => {
        return await requireActiveMembership(ctx, otherUserId, organizationId);
      });

      expect(result.userId).toBe(otherUserId);
      expect(result.status).toBe("active");
    });

    test("throws ConvexError for non-member", async () => {
      await expect(
        t.run(async (ctx) => {
          return await requireActiveMembership(ctx, nonMemberUserId, organizationId);
        }),
      ).rejects.toThrow(ConvexError);
    });

    test("throws with default NOT_ORG_MEMBER message", async () => {
      try {
        await t.run(async (ctx) => {
          return await requireActiveMembership(ctx, nonMemberUserId, organizationId);
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(String((error as ConvexError<string>).data)).toContain(ACCESS_ERRORS.NOT_ORG_MEMBER);
      }
    });

    test("throws with custom error message when provided", async () => {
      try {
        await t.run(async (ctx) => {
          return await requireActiveMembership(ctx, nonMemberUserId, organizationId, "Not allowed");
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(String((error as ConvexError<string>).data)).toContain("Not allowed");
      }
    });
  });

  // ─── getDocumentOrThrow ────────────────────────────────────────────

  describe("getDocumentOrThrow", () => {
    test("returns document when it exists and is active", async () => {
      const result = await t.run(async (ctx) => {
        return await getDocumentOrThrow(ctx, documentId);
      });

      expect(result._id).toBe(documentId);
      expect(result.name).toBe("Test Document");
    });

    test("throws ConvexError for non-existent document ID", async () => {
      const fakeId = "not_a_real_id" as Id<"documents">;
      await expect(
        t.run(async (ctx) => {
          return await getDocumentOrThrow(ctx, fakeId);
        }),
      ).rejects.toThrow();
    });

    test("throws ConvexError for deleted document", async () => {
      const deletedDocId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Deleted Doc",
          ownerId,
          organizationId,
          status: "deleted",
          sharingMode: "private",
          fileSize: 512,
          fileType: "application/pdf",
          storageId: "storage_deleted",
          createdAt: now,
          updatedAt: now,
        });
      });

      try {
        await t.run(async (ctx) => {
          return await getDocumentOrThrow(ctx, deletedDocId);
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(String((error as ConvexError<string>).data)).toContain(
          ACCESS_ERRORS.DOCUMENT_NOT_FOUND,
        );
      }
    });

    test("throws with custom error message when provided", async () => {
      const deletedDocId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Gone Doc",
          ownerId,
          organizationId,
          status: "deleted",
          sharingMode: "private",
          fileSize: 512,
          fileType: "application/pdf",
          storageId: "storage_gone",
          createdAt: now,
          updatedAt: now,
        });
      });

      try {
        await t.run(async (ctx) => {
          return await getDocumentOrThrow(ctx, deletedDocId, "Gone");
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConvexError);
        expect(String((error as ConvexError<string>).data)).toContain("Gone");
      }
    });
  });

  // ─── getDocumentWithAccessCheck ────────────────────────────────────

  describe("getDocumentWithAccessCheck", () => {
    test("returns document and access result for owner", async () => {
      const result = await t.run(async (ctx) => {
        return await getDocumentWithAccessCheck(ctx, ownerId, documentId);
      });

      expect(result.document._id).toBe(documentId);
      expect(result.access.hasAccess).toBe(true);
      expect(result.access.isOwner).toBe(true);
    });

    test("throws when user has no access", async () => {
      await expect(
        t.run(async (ctx) => {
          return await getDocumentWithAccessCheck(ctx, otherUserId, documentId);
        }),
      ).rejects.toThrow(ConvexError);
    });

    test("throws when document does not exist", async () => {
      const fakeId = "not_real" as Id<"documents">;
      await expect(
        t.run(async (ctx) => {
          return await getDocumentWithAccessCheck(ctx, ownerId, fakeId);
        }),
      ).rejects.toThrow();
    });
  });

  // ─── getDocumentWithManageCheck ────────────────────────────────────

  describe("getDocumentWithManageCheck", () => {
    test("returns document for owner", async () => {
      const result = await t.run(async (ctx) => {
        return await getDocumentWithManageCheck(ctx, ownerId, documentId);
      });

      expect(result._id).toBe(documentId);
    });

    test("throws when user cannot manage", async () => {
      await expect(
        t.run(async (ctx) => {
          return await getDocumentWithManageCheck(ctx, otherUserId, documentId);
        }),
      ).rejects.toThrow(ConvexError);
    });

    test("returns document for user with manage access record", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("document_access", {
          documentId,
          userId: otherUserId,
          permissionLevel: "manage",
          grantedBy: ownerId,
          grantedAt: now,
        });
      });

      const result = await t.run(async (ctx) => {
        return await getDocumentWithManageCheck(ctx, otherUserId, documentId);
      });

      expect(result._id).toBe(documentId);
    });
  });

  // ─── filterAccessibleDocuments ─────────────────────────────────────

  describe("filterAccessibleDocuments", () => {
    test("filters to only accessible documents", async () => {
      // Create a workspace doc (accessible to otherUser) and keep the private doc (not accessible)
      const workspaceDocId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Workspace Doc",
          ownerId,
          organizationId,
          status: "active",
          sharingMode: "workspace",
          fileSize: 1024,
          fileType: "application/pdf",
          storageId: "storage_ws_filter",
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.run(async (ctx) => {
        const privateDoc = sealAssertPresent(await ctx.db.get(documentId));
        const workspaceDoc = sealAssertPresent(await ctx.db.get(workspaceDocId));
        return await filterAccessibleDocuments(ctx, otherUserId, [privateDoc, workspaceDoc]);
      });

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe(workspaceDocId);
    });

    test("returns all documents for owner", async () => {
      const doc2Id = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Another Doc",
          ownerId,
          organizationId,
          status: "active",
          sharingMode: "private",
          fileSize: 1024,
          fileType: "application/pdf",
          storageId: "storage_another",
          createdAt: now,
          updatedAt: now,
        });
      });

      const result = await t.run(async (ctx) => {
        const doc1 = sealAssertPresent(await ctx.db.get(documentId));
        const doc2 = sealAssertPresent(await ctx.db.get(doc2Id));
        return await filterAccessibleDocuments(ctx, ownerId, [doc1, doc2]);
      });

      expect(result).toHaveLength(2);
    });

    test("returns empty array when no documents are accessible", async () => {
      const result = await t.run(async (ctx) => {
        const doc = sealAssertPresent(await ctx.db.get(documentId));
        return await filterAccessibleDocuments(ctx, nonMemberUserId, [doc]);
      });

      expect(result).toHaveLength(0);
    });

    test("returns empty array for empty input", async () => {
      const result = await t.run(async (ctx) => {
        return await filterAccessibleDocuments(ctx, ownerId, []);
      });

      expect(result).toHaveLength(0);
    });
  });
});
