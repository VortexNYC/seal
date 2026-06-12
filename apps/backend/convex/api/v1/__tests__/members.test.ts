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
        authSubject: "members_owner",
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
        authSubject: "members_admin",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    memberId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "member@members-test.com",
        authSubject: "members_member",
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
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      expect(result.members).toHaveLength(3);
      expect(result.hasMore).toBe(false);
      expect(result.members[0]?.role).toBe("owner");
      expect(result.members[1]?.role).toBe("admin");
      expect(result.members[2]?.role).toBe("member");
    });

    test("returns correct fields for each member", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      const owner = result.members.find((m) => m.role === "owner");
      expect(owner).toBeDefined();
      expect(owner?.email).toBe("owner@members-test.com");
      expect(owner?.name).toBe("Owner User");
      expect(owner?.status).toBe("active");
      expect(owner?.id).toBe(ownerMemberId);
      expect(owner?.user_id).toBe(ownerId);
      expect(owner?.joined_at).toBeDefined();
    });

    test("uses email as name fallback when user has no name", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      const member = result.members.find((m) => m.role === "member");
      expect(member?.name).toBe("member@members-test.com");
    });

    test("filters by role when specified", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        role: "admin",
      });

      expect(result.members).toHaveLength(1);
      expect(result.members[0]?.role).toBe("admin");
      expect(result.members[0]?.email).toBe("admin@members-test.com");
      expect(result.hasMore).toBe(false);
    });

    test("excludes system members", async () => {
      const systemUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          email: "system@internal.com",
          authSubject: "system",
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

      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      expect(result.members).toHaveLength(3);
      expect(result.members.every((m) => ["owner", "admin", "member", "viewer"].includes(m.role))).toBe(true);
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

      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId: emptyOrgId,
      });

      expect(result.members).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    // =========================================================================
    // Pagination
    // =========================================================================

    test("respects limit parameter", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        limit: 1,
      });

      expect(result.members).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
      expect(typeof result.nextCursor).toBe("string");
    });

    test("returns hasMore: false when results fit within limit", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        limit: 50,
      });

      expect(result.members).toHaveLength(3);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    test("supports cursor-based pagination through all pages", async () => {
      const page1 = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        limit: 1,
      });

      expect(page1.members).toHaveLength(1);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        limit: 1,
        cursor: page1.nextCursor,
      });

      expect(page2.members).toHaveLength(1);
      expect(page2.members[0]?.id).not.toBe(page1.members[0]?.id);
      expect(page2.hasMore).toBe(true);

      const page3 = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        limit: 1,
        cursor: page2.nextCursor,
      });

      expect(page3.members).toHaveLength(1);
      expect(page3.members[0]?.id).not.toBe(page1.members[0]?.id);
      expect(page3.members[0]?.id).not.toBe(page2.members[0]?.id);
      expect(page3.hasMore).toBe(false);
      expect(page3.nextCursor).toBeUndefined();
    });

    test("cursor with invalid value returns first page", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        cursor: "nonexistent_cursor_id",
      });

      expect(result.members).toHaveLength(3);
      expect(result.hasMore).toBe(false);
    });

    test("caps limit at 100", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        limit: 999,
      });

      // limit is clamped to 100, but only 3 members exist
      expect(result.members).toHaveLength(3);
      expect(result.hasMore).toBe(false);
    });

    // =========================================================================
    // Filtering
    // =========================================================================

    test("filters by search on name (case-insensitive)", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        search: "owner",
      });

      expect(result.members).toHaveLength(1);
      expect(result.members[0]?.name).toBe("Owner User");
    });

    test("filters by search on email (case-insensitive)", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        search: "admin@members-test",
      });

      expect(result.members).toHaveLength(1);
      expect(result.members[0]?.email).toBe("admin@members-test.com");
    });

    test("search returns empty when no matches", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        search: "nonexistent_user",
      });

      expect(result.members).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    test("filters by status", async () => {
      // Add an inactive member
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "inactive@members-test.com",
          name: "Inactive User",
          authSubject: "members_inactive",
          isEmailVerified: true,
          timezone: "UTC",
          locale: "en-US",
          activeOrganizationId: organizationId,
        });
        await ctx.db.insert("organization_members", {
          userId,
          organizationId,
          role: "member",
          status: "inactive",
          isPrimary: false,
        });
      });

      const activeResult = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        status: "active",
      });

      expect(activeResult.members).toHaveLength(3);
      expect(activeResult.members.every((m) => m.status === "active")).toBe(true);

      const inactiveResult = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        status: "inactive",
      });

      expect(inactiveResult.members).toHaveLength(1);
      expect(inactiveResult.members[0]?.name).toBe("Inactive User");
    });

    test("combines role filter with search", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        role: "admin",
        search: "admin",
      });

      expect(result.members).toHaveLength(1);
      expect(result.members[0]?.role).toBe("admin");
      expect(result.members[0]?.name).toBe("Admin User");
    });

    // =========================================================================
    // Sorting
    // =========================================================================

    test("sorts by name ascending", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        sort_by: "name",
        sort_order: "asc",
      });

      expect(result.members).toHaveLength(3);
      expect(result.members[0]?.name).toBe("Admin User");
      expect(result.members[1]?.name).toBe("member@members-test.com");
      expect(result.members[2]?.name).toBe("Owner User");
    });

    test("sorts by name descending", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        sort_by: "name",
        sort_order: "desc",
      });

      expect(result.members).toHaveLength(3);
      expect(result.members[0]?.name).toBe("Owner User");
      expect(result.members[1]?.name).toBe("member@members-test.com");
      expect(result.members[2]?.name).toBe("Admin User");
    });

    test("sorts by email ascending", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        sort_by: "email",
        sort_order: "asc",
      });

      expect(result.members).toHaveLength(3);
      expect(result.members[0]?.email).toBe("admin@members-test.com");
      expect(result.members[1]?.email).toBe("member@members-test.com");
      expect(result.members[2]?.email).toBe("owner@members-test.com");
    });

    test("sorts by joined_at ascending", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        sort_by: "joined_at",
        sort_order: "asc",
      });

      expect(result.members).toHaveLength(3);
      // All seeded at same time, so order is stable by insertion order
      for (let i = 1; i < result.members.length; i++) {
        expect(
          new Date(result.members[i]!.joined_at).getTime(),
        ).toBeGreaterThanOrEqual(
          new Date(result.members[i - 1]!.joined_at).getTime(),
        );
      }
    });

    test("sorts by joined_at descending", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        sort_by: "joined_at",
        sort_order: "desc",
      });

      expect(result.members).toHaveLength(3);
      for (let i = 1; i < result.members.length; i++) {
        expect(
          new Date(result.members[i]!.joined_at).getTime(),
        ).toBeLessThanOrEqual(
          new Date(result.members[i - 1]!.joined_at).getTime(),
        );
      }
    });

    test("default sort is by role ascending", async () => {
      const result = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
      });

      expect(result.members[0]?.role).toBe("owner");
      expect(result.members[1]?.role).toBe("admin");
      expect(result.members[2]?.role).toBe("member");
    });

    test("paginated results maintain sort order", async () => {
      const page1 = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        sort_by: "name",
        sort_order: "desc",
        limit: 2,
      });

      expect(page1.members).toHaveLength(2);
      expect(page1.members[0]?.name).toBe("Owner User");
      expect(page1.members[1]?.name).toBe("member@members-test.com");
      expect(page1.hasMore).toBe(true);

      const page2 = await t.query(internal.api.v1.members.listMembers, {
        userId: ownerId,
        organizationId,
        sort_by: "name",
        sort_order: "desc",
        limit: 2,
        cursor: page1.nextCursor,
      });

      expect(page2.members).toHaveLength(1);
      expect(page2.members[0]?.name).toBe("Admin User");
      expect(page2.hasMore).toBe(false);
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
        memberId: ownerMemberId,
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
