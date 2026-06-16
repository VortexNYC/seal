import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";
import { seedTestOrganizationMember } from "../../testVortexAuth";

describe("Contact mutations", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Contacts Test Org",
        slug: "contacts-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "admin@contacts-test.com",
        name: "Admin User",
        authSubject: "contacts_admin",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    // Owner membership (has all permissions including contacts:*)
    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId,
        organizationId,
        role: "owner",
        status: "active",
      });
    });
  });

  const asAdmin = () => t.withIdentity({ subject: "contacts_admin" });

  describe("create", () => {
    test("creates a contact with required fields", async () => {
      const result = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result._id).toBeDefined();
      expect(result.isDuplicate).toBe(false);
    });

    test("computes fullName from first and last name", async () => {
      const { _id } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(_id);
      })) as Doc<"contacts"> | null;

      expect(contact?.fullName).toBe("Jane Smith");
    });

    test("normalizes email to lowercase", async () => {
      const { _id } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Test",
        lastName: "User",
        email: "  Test@EXAMPLE.COM  ",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(_id);
      })) as Doc<"contacts"> | null;

      expect(contact?.email).toBe("test@example.com");
    });

    test("defaults status to active", async () => {
      const { _id } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Default",
        lastName: "Status",
        email: "default@example.com",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(_id);
      })) as Doc<"contacts"> | null;

      expect(contact?.status).toBe("active");
    });

    test("creates contact with all optional fields", async () => {
      const { _id } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Full",
        lastName: "Contact",
        email: "full@example.com",
        phone: "+1-555-0100",
        company: "ACME Inc",
        title: "CEO",
        status: "lead",
        notes: "Met at conference",
        tags: ["vip", "conference-2026"],
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(_id);
      })) as Doc<"contacts"> | null;

      expect(contact?.phone).toBe("+1-555-0100");
      expect(contact?.company).toBe("ACME Inc");
      expect(contact?.title).toBe("CEO");
      expect(contact?.status).toBe("lead");
      expect(contact?.notes).toBe("Met at conference");
      expect(contact?.tags).toEqual(["vip", "conference-2026"]);
    });

    test("detects duplicate email within org", async () => {
      await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "First",
        lastName: "Contact",
        email: "duplicate@example.com",
      });

      const result = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Second",
        lastName: "Contact",
        email: "duplicate@example.com",
      });

      expect(result.isDuplicate).toBe(true);
      // Still creates the contact (non-blocking duplicate warning)
      expect(result._id).toBeDefined();
    });

    test("sets createdBy to current user", async () => {
      const { _id } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Created",
        lastName: "By",
        email: "created@example.com",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(_id);
      })) as Doc<"contacts"> | null;

      expect(contact?.createdBy).toBe(userId);
    });

    test("sets timestamps", async () => {
      const before = Date.now();
      const { _id } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Time",
        lastName: "Stamp",
        email: "time@example.com",
      });
      const after = Date.now();

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(_id);
      })) as Doc<"contacts"> | null;

      expect(contact?.createdAt).toBeGreaterThanOrEqual(before);
      expect(contact?.createdAt).toBeLessThanOrEqual(after);
      expect(contact?.updatedAt).toBeGreaterThanOrEqual(before);
    });
  });

  describe("update", () => {
    let contactId: Id<"contacts">;

    beforeEach(async () => {
      const result = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Original",
        lastName: "Name",
        email: "original@example.com",
        company: "Old Company",
      });
      contactId = result._id;
    });

    test("updates individual fields", async () => {
      await asAdmin().mutation(api.contacts.mutations.update, {
        id: contactId,
        company: "New Company",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(contactId);
      })) as Doc<"contacts"> | null;

      expect(contact?.company).toBe("New Company");
      // Other fields unchanged
      expect(contact?.firstName).toBe("Original");
    });

    test("recomputes fullName when firstName changes", async () => {
      await asAdmin().mutation(api.contacts.mutations.update, {
        id: contactId,
        firstName: "Updated",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(contactId);
      })) as Doc<"contacts"> | null;

      expect(contact?.fullName).toBe("Updated Name");
    });

    test("recomputes fullName when lastName changes", async () => {
      await asAdmin().mutation(api.contacts.mutations.update, {
        id: contactId,
        lastName: "Changed",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(contactId);
      })) as Doc<"contacts"> | null;

      expect(contact?.fullName).toBe("Original Changed");
    });

    test("normalizes email on update", async () => {
      await asAdmin().mutation(api.contacts.mutations.update, {
        id: contactId,
        email: "  UPPER@CASE.COM  ",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(contactId);
      })) as Doc<"contacts"> | null;

      expect(contact?.email).toBe("upper@case.com");
    });

    test("updates status", async () => {
      await asAdmin().mutation(api.contacts.mutations.update, {
        id: contactId,
        status: "inactive",
      });

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(contactId);
      })) as Doc<"contacts"> | null;

      expect(contact?.status).toBe("inactive");
    });

    test("throws on non-existent contact", async () => {
      const fakeId = "k17abc123def456gh" as Id<"contacts">;

      await expect(
        asAdmin().mutation(api.contacts.mutations.update, {
          id: fakeId,
          firstName: "Ghost",
        }),
      ).rejects.toThrow();
    });
  });

  describe("remove", () => {
    test("deletes a contact", async () => {
      const { _id } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Delete",
        lastName: "Me",
        email: "delete@example.com",
      });

      const result = await asAdmin().mutation(api.contacts.mutations.remove, {
        id: _id,
      });

      expect(result).toBe(_id);

      const contact = (await t.run(async (ctx) => {
        return await ctx.db.get(_id);
      })) as Doc<"contacts"> | null;

      expect(contact).toBeNull();
    });

    test("throws on non-existent contact", async () => {
      const fakeId = "k17abc123def456gh" as Id<"contacts">;

      await expect(
        asAdmin().mutation(api.contacts.mutations.remove, {
          id: fakeId,
        }),
      ).rejects.toThrow();
    });
  });

  describe("bulkDelete", () => {
    test("deletes multiple contacts", async () => {
      const c1 = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Bulk1",
        lastName: "Delete",
        email: "bulk1@example.com",
      });

      const c2 = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Bulk2",
        lastName: "Delete",
        email: "bulk2@example.com",
      });

      const results = await asAdmin().mutation(api.contacts.mutations.bulkDelete, {
        ids: [c1._id, c2._id],
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      // Verify contacts are deleted
      const remaining = await t.run(async (ctx) => {
        return [await ctx.db.get(c1._id), await ctx.db.get(c2._id)];
      });

      expect(remaining[0]).toBeNull();
      expect(remaining[1]).toBeNull();
    });

    test("reports errors for already-deleted contacts", async () => {
      // Create and delete a contact to get a valid-format ID that no longer exists
      const { _id: deletedId } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Ghost",
        lastName: "Contact",
        email: "ghost@example.com",
      });
      await asAdmin().mutation(api.contacts.mutations.remove, {
        id: deletedId,
      });

      const results = await asAdmin().mutation(api.contacts.mutations.bulkDelete, {
        ids: [deletedId],
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe("Contact not found");
    });

    test("handles mixed success and failure", async () => {
      const c1 = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Real",
        lastName: "Contact",
        email: "real@example.com",
      });

      // Create and delete to get a valid-format but non-existent ID
      const { _id: deletedId } = await asAdmin().mutation(api.contacts.mutations.create, {
        firstName: "Temp",
        lastName: "Contact",
        email: "temp@example.com",
      });
      await asAdmin().mutation(api.contacts.mutations.remove, {
        id: deletedId,
      });

      const results = await asAdmin().mutation(api.contacts.mutations.bulkDelete, {
        ids: [c1._id, deletedId],
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });

    test("handles empty array", async () => {
      const results = await asAdmin().mutation(api.contacts.mutations.bulkDelete, { ids: [] });

      expect(results).toEqual([]);
    });
  });
});
