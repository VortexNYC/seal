import { beforeEach, describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";
import { seedTestOrganizationMember } from "../testVortexAuth";

describe("Payment field queries", () => {
  let t: ReturnType<typeof createTestContext>;
  let organizationId: Id<"organizations">;
  let documentId: Id<"documents">;
  let recipientId: Id<"document_recipients">;
  let paymentFieldId: Id<"signature_fields">;
  let ownerId: Id<"users">;

  beforeEach(async () => {
    t = createTestContext();

    organizationId = await t.run(async (ctx) => {
      return await ctx.db.insert("organizations", {
        name: "Query Test Org",
        slug: "query-test-org",
        type: "company",
        isActive: true,
        timezone: "UTC",
        updatedAt: Date.now(),
      });
    });

    ownerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "owner@querytest.com",
        name: "Query Owner",
        authSubject: "query_owner",
        isEmailVerified: true,
        timezone: "UTC",
        locale: "en-US",
        activeOrganizationId: organizationId,
      });
    });

    await t.run(async (ctx) => {
      await seedTestOrganizationMember(ctx, {
        userId: ownerId,
        organizationId,
        role: "owner",
        status: "active",
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Query Test Doc",
        ownerId,
        organizationId,
        status: "active",
        sharingMode: "private",
        fileSize: 1024,
        fileType: "application/pdf",
        storageId: "storage-query",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "signer@querytest.com",
        name: "Query Signer",
        role: "signer",
        status: "pending",
        order: 1,
        signingToken: "test-token-query",
        tokenExpiresAt: Date.now() + 86_400_000,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    paymentFieldId = await t.run(async (ctx) => {
      return await ctx.db.insert("signature_fields", {
        documentId,
        recipientId,
        fieldType: "payment",
        label: "Payment",
        isRequired: true,
        x: 10,
        y: 10,
        width: 220,
        height: 60,
        page: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  describe("getPaymentConfigByField", () => {
    test("returns null when no config exists", async () => {
      const result = await t.query(
        api.payment_fields.queries.getPaymentConfigByField,
        {
          fieldId: paymentFieldId,
        }
      );

      expect(result).toBeNull();
    });

    test("returns config after creation", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("payment_field_configs", {
          fieldId: paymentFieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [
            {
              id: "item-1",
              description: "Service",
              quantity: 1,
              unitPrice: 5000,
            },
          ],
          currency: "usd",
          dueDateTerms: "on_receipt",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          taxEnabled: false,
          totalAmountCents: 5000,
          paymentStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(
        api.payment_fields.queries.getPaymentConfigByField,
        {
          fieldId: paymentFieldId,
        }
      );

      expect(result).toBeDefined();
      expect(result?.paymentType).toBe("one_time");
      expect(result?.totalAmountCents).toBe(5000);
      expect(result?.items).toHaveLength(1);
    });
  });

  describe("getPaymentConfigsByDocument", () => {
    test("returns empty array when no configs exist", async () => {
      const results = await t.query(
        api.payment_fields.queries.getPaymentConfigsByDocument,
        {
          documentId,
        }
      );

      expect(results).toEqual([]);
    });

    test("returns all configs for a document", async () => {
      // Create a second recipient and payment field
      const recipientId2 = await t.run(async (ctx) => {
        return await ctx.db.insert("document_recipients", {
          documentId,
          email: "signer2@querytest.com",
          name: "Second Signer",
          role: "signer",
          status: "pending",
          order: 2,
          signingToken: "test-token-query-2",
          tokenExpiresAt: Date.now() + 86_400_000,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const paymentFieldId2 = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          recipientId: recipientId2,
          fieldType: "payment",
          label: "Payment 2",
          isRequired: true,
          x: 10,
          y: 80,
          width: 220,
          height: 60,
          page: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Insert two configs
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("payment_field_configs", {
          fieldId: paymentFieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [
            {
              id: "item-1",
              description: "Fee A",
              quantity: 1,
              unitPrice: 5000,
            },
          ],
          currency: "usd",
          dueDateTerms: "on_receipt",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          taxEnabled: false,
          totalAmountCents: 5000,
          paymentStatus: "pending",
          createdAt: now,
          updatedAt: now,
        });
        await ctx.db.insert("payment_field_configs", {
          fieldId: paymentFieldId2,
          documentId,
          organizationId,
          paymentType: "recurring",
          items: [
            {
              id: "item-2",
              description: "Fee B",
              quantity: 1,
              unitPrice: 10000,
            },
          ],
          currency: "usd",
          dueDateTerms: "net_30",
          recurringConfig: {
            interval: "month",
            intervalCount: 1,
            endCondition: "never",
          },
          allowedPaymentMethods: ["card", "ach_debit"],
          feeHandling: "pass_to_recipient",
          taxEnabled: false,
          totalAmountCents: 10000,
          paymentStatus: "pending",
          createdAt: now,
          updatedAt: now,
        });
      });

      const results = await t.query(
        api.payment_fields.queries.getPaymentConfigsByDocument,
        {
          documentId,
        }
      );

      expect(results).toHaveLength(2);
      expect(
        results.map((r: (typeof results)[number]) => r.paymentType).toSorted()
      ).toEqual(["one_time", "recurring"]);
    });

    test("does not return configs from other documents", async () => {
      const otherDocId = await t.run(async (ctx) => {
        return await ctx.db.insert("documents", {
          name: "Other Doc",
          ownerId,
          organizationId,
          status: "active",
          sharingMode: "private",
          fileSize: 512,
          fileType: "application/pdf",
          storageId: "storage-other",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Insert config on original document
      await t.run(async (ctx) => {
        await ctx.db.insert("payment_field_configs", {
          fieldId: paymentFieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [
            { id: "item-1", description: "Fee", quantity: 1, unitPrice: 5000 },
          ],
          currency: "usd",
          dueDateTerms: "on_receipt",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          taxEnabled: false,
          totalAmountCents: 5000,
          paymentStatus: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Query other document should return empty
      const results = await t.query(
        api.payment_fields.queries.getPaymentConfigsByDocument,
        {
          documentId: otherDocId,
        }
      );

      expect(results).toEqual([]);
    });
  });

  describe("by_provider_subscription index", () => {
    test("can look up config by providerSubscriptionId", async () => {
      const subscriptionId = "sub_index_test_456";

      // Insert a config with a providerSubscriptionId
      const configId = await t.run(async (ctx) => {
        return await ctx.db.insert("payment_field_configs", {
          fieldId: paymentFieldId,
          documentId,
          organizationId,
          paymentType: "recurring",
          items: [
            {
              id: "item-1",
              description: "Monthly Service",
              quantity: 1,
              unitPrice: 10000,
            },
          ],
          currency: "usd",
          dueDateTerms: "net_30",
          recurringConfig: {
            interval: "month",
            intervalCount: 1,
            endCondition: "never",
          },
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          taxEnabled: false,
          totalAmountCents: 10000,
          paymentStatus: "awaiting",
          providerSubscriptionId: subscriptionId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Query using the index
      const result = await t.run(async (ctx) => {
        return await ctx.db
          .query("payment_field_configs")
          .withIndex("by_provider_subscription", (q) =>
            q.eq("providerSubscriptionId", subscriptionId)
          )
          .first();
      });

      expect(result).toBeDefined();
      expect(result?._id).toBe(configId);
      expect(result?.providerSubscriptionId).toBe(subscriptionId);
      expect(result?.paymentType).toBe("recurring");
    });

    test("returns null for non-existent subscriptionId", async () => {
      const result = await t.run(async (ctx) => {
        return await ctx.db
          .query("payment_field_configs")
          .withIndex("by_provider_subscription", (q) =>
            q.eq("providerSubscriptionId", "sub_nonexistent")
          )
          .first();
      });

      expect(result).toBeNull();
    });
  });
});
