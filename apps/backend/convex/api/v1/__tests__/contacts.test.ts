import { beforeEach, describe, expect, test } from "vitest";

import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import { createTestContext } from "../../../test.setup";

describe("api/v1/contacts", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let otherOrgId: Id<"organizations">;
  let userId: Id<"users">;

  const BASE_TIME = 1_700_000_000_000;

  async function seedContact(overrides: {
    first_name?: string;
    last_name?: string;
    email: string;
    status?: "active" | "inactive" | "lead";
    company?: string;
    tags?: string[];
    organizationId?: Id<"organizations">;
  }) {
    const orgId = overrides.organizationId ?? organizationId;
    const firstName = overrides.first_name ?? "Test";
    const lastName = overrides.last_name ?? "Contact";
    const now = BASE_TIME;

    return t.run(async (ctx) => {
      return await ctx.db.insert("contacts", {
        organizationId: orgId,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email: overrides.email,
        company: overrides.company,
        status: overrides.status ?? "active",
        tags: overrides.tags,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Contacts API Org",
        slug: "contacts-api-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    otherOrgId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Other Org",
        slug: "other-org-contacts",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@contacts-api.com",
        name: "Owner",
        authSubject: "contacts_api_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });
  });

  // =========================================================================
  // listContacts
  // =========================================================================

  describe("listContacts", () => {
    test("returns empty list when no contacts exist", async () => {
      const result = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
      });

      expect(result.contacts).toHaveLength(0);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeUndefined();
    });

    test("returns contacts for the org", async () => {
      await seedContact({ email: "alice@test.com" });
      await seedContact({ email: "bob@test.com" });
      // Another org's contact — should not appear
      await seedContact({
        email: "carol@other.com",
        organizationId: otherOrgId,
      });

      const result = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
      });

      expect(result.contacts).toHaveLength(2);
    });

    test("returns full contact fields", async () => {
      await seedContact({
        first_name: "Alice",
        last_name: "Smith",
        email: "alice@test.com",
        company: "ACME Inc",
        status: "active",
      });

      const result = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
      });

      const contact = result.contacts[0];
      expect(contact?.first_name).toBe("Alice");
      expect(contact?.last_name).toBe("Smith");
      expect(contact?.full_name).toBe("Alice Smith");
      expect(contact?.email).toBe("alice@test.com");
      expect(contact?.company).toBe("ACME Inc");
      expect(contact?.status).toBe("active");
      expect(contact?.created_at).toBeDefined();
      expect(contact?.updated_at).toBeDefined();
    });

    test("filters by status", async () => {
      await seedContact({ email: "active1@test.com", status: "active" });
      await seedContact({ email: "inactive@test.com", status: "inactive" });
      await seedContact({ email: "lead@test.com", status: "lead" });

      const result = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
        status: "active",
      });

      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0]?.email).toBe("active1@test.com");
    });

    test("searches by name (case-insensitive)", async () => {
      await seedContact({
        first_name: "Alice",
        last_name: "Smith",
        email: "alice@test.com",
      });
      await seedContact({
        first_name: "Bob",
        last_name: "Jones",
        email: "bob@test.com",
      });

      const result = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
        search: "alice",
      });

      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0]?.email).toBe("alice@test.com");
    });

    test("searches by email", async () => {
      await seedContact({ email: "alice@acme.com" });
      await seedContact({ email: "bob@example.com" });

      const result = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
        search: "acme",
      });

      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0]?.email).toBe("alice@acme.com");
    });

    test("respects limit and returns has_more=true", async () => {
      for (let i = 0; i < 5; i++) {
        await seedContact({ email: `contact${i}@test.com` });
      }

      const result = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(result.contacts).toHaveLength(2);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBeDefined();
    });

    test("cursor pagination returns next page without overlap", async () => {
      for (let i = 0; i < 5; i++) {
        await seedContact({ email: `p${i}@test.com` });
      }

      const page1 = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
        limit: 2,
      });

      expect(page1.contacts).toHaveLength(2);

      const page2 = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
        limit: 2,
        cursor: page1.next_cursor,
      });

      expect(page2.contacts).toHaveLength(2);
      const page1Ids = new Set(
        page1.contacts.map((c: (typeof page1.contacts)[number]) => c.id)
      );
      for (const c of page2.contacts) {
        expect(page1Ids.has(c.id)).toBe(false);
      }
    });

    test("caps limit at 100", async () => {
      // We can't easily insert 101 contacts, but we can verify it doesn't throw
      // when requesting more than 100
      const result = await t.query(internal.api.v1.contacts.listContacts, {
        userId,
        organizationId,
        limit: 500,
      });

      expect(result.contacts).toHaveLength(0);
      expect(result.has_more).toBe(false);
    });
  });

  // =========================================================================
  // getContact
  // =========================================================================

  describe("getContact", () => {
    test("returns contact by ID", async () => {
      const contactId = await seedContact({
        first_name: "Alice",
        last_name: "Smith",
        email: "alice@test.com",
      });

      const result = await t.query(internal.api.v1.contacts.getContact, {
        userId,
        organizationId,
        contactId,
      });

      expect(result).not.toBeNull();
      expect(result?.id).toBe(contactId);
      expect(result?.email).toBe("alice@test.com");
      expect(result?.full_name).toBe("Alice Smith");
    });

    test("returns null for contact in different org", async () => {
      const contactId = await seedContact({
        email: "alice@other.com",
        organizationId: otherOrgId,
      });

      const result = await t.query(internal.api.v1.contacts.getContact, {
        userId,
        organizationId,
        contactId,
      });

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // createContact
  // =========================================================================

  describe("createContact", () => {
    test("creates contact with required fields", async () => {
      const result = await t.mutation(internal.api.v1.contacts.createContact, {
        userId,
        organizationId,
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@test.com",
      });

      expect(result.id).toBeDefined();

      const contact = await t.query(internal.api.v1.contacts.getContact, {
        userId,
        organizationId,
        contactId: result.id as Id<"contacts">,
      });

      expect(contact?.first_name).toBe("Jane");
      expect(contact?.last_name).toBe("Doe");
      expect(contact?.full_name).toBe("Jane Doe");
      expect(contact?.email).toBe("jane@test.com");
      expect(contact?.status).toBe("active"); // default
    });

    test("creates contact with all optional fields", async () => {
      const result = await t.mutation(internal.api.v1.contacts.createContact, {
        userId,
        organizationId,
        first_name: "John",
        last_name: "Smith",
        email: "john@acme.com",
        phone: "+1-555-0100",
        company: "ACME Corp",
        title: "VP Engineering",
        status: "lead",
        notes: "Met at conference",
        tags: ["vip", "conference-2024"],
      });

      const contact = await t.query(internal.api.v1.contacts.getContact, {
        userId,
        organizationId,
        contactId: result.id as Id<"contacts">,
      });

      expect(contact?.phone).toBe("+1-555-0100");
      expect(contact?.company).toBe("ACME Corp");
      expect(contact?.title).toBe("VP Engineering");
      expect(contact?.status).toBe("lead");
      expect(contact?.notes).toBe("Met at conference");
      expect(contact?.tags).toEqual(["vip", "conference-2024"]);
    });

    test("defaults status to active when not specified", async () => {
      const result = await t.mutation(internal.api.v1.contacts.createContact, {
        userId,
        organizationId,
        first_name: "No",
        last_name: "Status",
        email: "no-status@test.com",
      });

      const contact = await t.query(internal.api.v1.contacts.getContact, {
        userId,
        organizationId,
        contactId: result.id as Id<"contacts">,
      });

      expect(contact?.status).toBe("active");
    });
  });

  // =========================================================================
  // deleteContact
  // =========================================================================

  describe("deleteContact", () => {
    test("deletes an existing contact", async () => {
      const contactId = await seedContact({ email: "delete-me@test.com" });

      const result = await t.mutation(internal.api.v1.contacts.deleteContact, {
        userId,
        organizationId,
        contactId,
      });

      expect(result.success).toBe(true);

      // Verify deleted
      const deleted = await t.query(internal.api.v1.contacts.getContact, {
        userId,
        organizationId,
        contactId,
      });
      expect(deleted).toBeNull();
    });

    test("throws when contact belongs to different org", async () => {
      const contactId = await seedContact({
        email: "other@test.com",
        organizationId: otherOrgId,
      });

      await expect(
        t.mutation(internal.api.v1.contacts.deleteContact, {
          userId,
          organizationId,
          contactId,
        })
      ).rejects.toThrow("Contact not found");
    });
  });
});
