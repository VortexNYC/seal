import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { createTestContext } from "../../test.setup";

describe("Contact queries", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let userId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Contacts Query Org",
        slug: "contacts-query-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@contacts-query.com",
        name: "Owner User",
        clerkId: "clerk_contacts_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("organization_members", {
        userId,
        organizationId,
        role: "owner",
        status: "active",
        isPrimary: true,
      });
    });
  });

  const asOwner = () => t.withIdentity({ subject: "clerk_contacts_owner" });

  describe("list", () => {
    test("returns all contacts for the org", async () => {
      await asOwner().mutation(api.contacts.mutations.create, {
        firstName: "Alice",
        lastName: "A",
        email: "alice@test.com",
      });
      await asOwner().mutation(api.contacts.mutations.create, {
        firstName: "Bob",
        lastName: "B",
        email: "bob@test.com",
      });

      const contacts = await asOwner().query(api.contacts.queries.list, {});

      expect(contacts).toHaveLength(2);
    });

    test("filters by status", async () => {
      await asOwner().mutation(api.contacts.mutations.create, {
        firstName: "Active",
        lastName: "User",
        email: "active@test.com",
        status: "active",
      });
      await asOwner().mutation(api.contacts.mutations.create, {
        firstName: "Lead",
        lastName: "User",
        email: "lead@test.com",
        status: "lead",
      });

      const leads = await asOwner().query(api.contacts.queries.list, {
        status: "lead",
      });

      expect(leads).toHaveLength(1);
      expect(leads[0].firstName).toBe("Lead");
    });

    test("returns empty array when no contacts exist", async () => {
      const contacts = await asOwner().query(api.contacts.queries.list, {});
      expect(contacts).toEqual([]);
    });
  });

  describe("getById", () => {
    test("returns contact by ID", async () => {
      const { _id } = await asOwner().mutation(api.contacts.mutations.create, {
        firstName: "Get",
        lastName: "ById",
        email: "getby@test.com",
      });

      const contact = await asOwner().query(api.contacts.queries.getById, {
        id: _id,
      });

      expect(contact.firstName).toBe("Get");
      expect(contact.lastName).toBe("ById");
      expect(contact.email).toBe("getby@test.com");
    });

    test("throws for non-existent contact", async () => {
      const fakeId = "k17abc123def456gh" as Id<"contacts">;

      await expect(
        asOwner().query(api.contacts.queries.getById, { id: fakeId }),
      ).rejects.toThrow();
    });
  });

  describe("getByEmail", () => {
    test("returns contact matching email", async () => {
      await asOwner().mutation(api.contacts.mutations.create, {
        firstName: "Email",
        lastName: "Lookup",
        email: "lookup@test.com",
      });

      const contact = await asOwner().query(api.contacts.queries.getByEmail, {
        email: "lookup@test.com",
      });

      expect(contact).not.toBeNull();
      expect(contact?.fullName).toBe("Email Lookup");
    });

    test("returns null for non-existent email", async () => {
      const contact = await asOwner().query(api.contacts.queries.getByEmail, {
        email: "nonexistent@test.com",
      });

      expect(contact).toBeNull();
    });
  });

  describe("suggestForRecipient", () => {
    test("returns empty for search term shorter than 2 chars", async () => {
      await asOwner().mutation(api.contacts.mutations.create, {
        firstName: "Alice",
        lastName: "Anderson",
        email: "alice@test.com",
      });

      const results = await asOwner().query(
        api.contacts.queries.suggestForRecipient,
        { searchTerm: "A" },
      );

      expect(results).toEqual([]);
    });

    test("returns empty for empty search term", async () => {
      const results = await asOwner().query(
        api.contacts.queries.suggestForRecipient,
        { searchTerm: "" },
      );

      expect(results).toEqual([]);
    });

    test("returns matching contacts with limited fields", async () => {
      await asOwner().mutation(api.contacts.mutations.create, {
        firstName: "Charlie",
        lastName: "Chen",
        email: "charlie@test.com",
        company: "ChenCo",
      });

      const results = await asOwner().query(
        api.contacts.queries.suggestForRecipient,
        { searchTerm: "Charlie" },
      );

      expect(results.length).toBeGreaterThan(0);
      const first = results[0];
      expect(first).toHaveProperty("_id");
      expect(first).toHaveProperty("fullName");
      expect(first).toHaveProperty("email");
      expect(first).toHaveProperty("company");
      // Should not leak other fields
      expect(first).not.toHaveProperty("phone");
      expect(first).not.toHaveProperty("notes");
    });
  });

  describe("getRelatedDocuments", () => {
    test("returns documents where contact is a recipient", async () => {
      // Create a document in the org
      const documentId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Related Doc",
          ownerId: userId,
          organizationId,
          status: "active",
          sharingMode: "private",
          fileSize: 1024,
          fileType: "application/pdf",
          storageId: "storage-related",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Add recipient with the contact's email
      await t.run(async (ctx) => {
        await ctx.db.insert("document_recipients", {
          documentId,
          email: "linked@test.com",
          name: "Linked Contact",
          role: "signer",
          status: "pending",
          order: 1,
          signingToken: "token-linked",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const docs = await asOwner().query(
        api.contacts.queries.getRelatedDocuments,
        { email: "linked@test.com" },
      );

      expect(docs).toHaveLength(1);
      expect(docs[0].name).toBe("Related Doc");
      expect(docs[0].role).toBe("signer");
    });

    test("returns empty array when no documents match", async () => {
      const docs = await asOwner().query(
        api.contacts.queries.getRelatedDocuments,
        { email: "unlinked@test.com" },
      );

      expect(docs).toEqual([]);
    });
  });
});
