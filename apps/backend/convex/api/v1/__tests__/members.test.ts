import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/members", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let ownerId: Id<"users">;
  let adminId: Id<"users">;
  let memberId: Id<"users">;
  let ownerMemberId: Id<"organization_members">;
  let adminMemberId: Id<"organization_members">;
  let _regularMemberId: Id<"organization_members">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Members Test Org",
        slug: "members-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@members-test.com",
        name: "Owner User",
        clerkId: "clerk_members_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@members-test.com",
        name: "Admin User",
        clerkId: "clerk_members_admin",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    memberId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        // No name set — should fall back to email
        email: "member@members-test.com",
        clerkId: "clerk_members_member",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    ownerMemberId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_members", {
        userId: ownerId,
        organizationId,
        role: "owner",
        status: "active",
        isPrimary: true,
      });
    });

    adminMemberId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_members", {
        userId: adminId,
        organizationId,
        role: "admin",
        status: "active",
        isPrimary: false,
      });
    });

    _regularMemberId = await t.run(async (ctx) => {
      return await ctx.db.insert("organization_members", {
        userId: memberId,
        organizationId,
        role: "member",
        status: "active",
        isPrimary: false,
      });
    });
  });

  // =========================================================================
  // listMembers
  // =========================================================================

  describe("listMembers", () => {
    test("returns all non-system members sorted by role", async () => {
      const results = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      expect(results).toHaveLength(3);
      // Owner comes first, then admin, then member
      expect(results[0]?.role).toBe("owner");
      expect(results[1]?.role).toBe("admin");
      expect(results[2]?.role).toBe("member");
    });

    test("returns correct fields for each member", async () => {
      const results = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      const owner = results.find((m: (typeof results)[number]) => m.role === "owner");
      expect(owner).toBeDefined();
      expect(owner?.email).toBe("owner@members-test.com");
      expect(owner?.name).toBe("Owner User");
      expect(owner?.status).toBe("active");
      expect(owner?.id).toBe(ownerMemberId);
      expect(owner?.user_id).toBe(ownerId);
      expect(owner?.joined_at).toBeDefined();
    });

    test("uses email as name fallback when user has no name", async () => {
      const results = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      const member = results.find((m: (typeof results)[number]) => m.role === "member");
      expect(member?.name).toBe("member@members-test.com");
    });

    test("filters by role when specified", async () => {
      const adminOnly = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        role: "admin",
      });

      expect(adminOnly).toHaveLength(1);
      expect(adminOnly[0]?.role).toBe("admin");
      expect(adminOnly[0]?.email).toBe("admin@members-test.com");
    });

    test("excludes system members", async () => {
      // Add a system member
      const systemUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          email: "system@internal.com",
          clerkId: "clerk_system",
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
        });
      });
      await t.run(async (ctx) => {
        await ctx.db.insert("organization_members", {
          userId: systemUserId,
          organizationId,
          role: "system",
          status: "active",
          isPrimary: false,
        });
      });

      const results = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      // Still 3 — system member excluded (only owner, admin, member returned)
      expect(results).toHaveLength(3);
      expect(
        results.every((m: (typeof results)[number]) =>
          ["owner", "admin", "member", "viewer"].includes(m.role),
        ),
      ).toBe(true);
    });

    test("returns empty array for org with no members", async () => {
      const emptyOrgId = await t.run(async (ctx) => {
        return await ctx.db.insert("organizations", {
          name: "Empty Org",
          slug: "empty-org",
          type: "company",
          isActive: true,
          timezone: "UTC",
          updatedAt: Date.now(),
        });
      });

      const results = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId: emptyOrgId,
      });

      expect(results).toHaveLength(0);
    });
  });

  // =========================================================================
  // getMember
  // =========================================================================

  describe("getMember", () => {
    test("returns member details by membership ID", async () => {
      const result = await t.query(internal.api.v1.members.getMember, {
        userId: ownerId,
        organizationId,
        memberId: adminMemberId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(adminMemberId);
      expect(result?.email).toBe("admin@members-test.com");
      expect(result?.role).toBe("admin");
    });

    test("returns null when member does not exist", async () => {
      const result = await t.query(internal.api.v1.members.getMember, {
        userId: ownerId,
        organizationId: otherOrgId,
        memberId: ownerMemberId, // ownerMemberId belongs to organizationId, not otherOrgId
      });

      expect(result).toBeNull();
    });

    test("returns null when membership belongs to a different org", async () => {
      const result = await t.query(internal.api.v1.members.getMember, {
        userId: ownerId,
        organizationId: otherOrgId,
        memberId: adminMemberId,
      });

      expect(result).toBeNull();
    });

    test("returns joined_at as valid ISO timestamp", async () => {
      const result = await t.query(internal.api.v1.members.getMember, {
        userId: ownerId,
        organizationId,
        memberId: ownerMemberId,
      });

      expect(result?.joined_at).toBeDefined();
      expect(new Date(result!.joined_at).toISOString()).toBe(result!.joined_at);
    });
  });
});
