import { beforeEach, describe, expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";

/**
 * Shared test data factory for payment field tests.
 */
function makeValidPaymentArgs(fieldId: Id<"signature_fields">) {
  return {
    fieldId,
    paymentType: "one_time" as const,
    items: [{ id: "item-1", description: "Consulting fee", quantity: 1, unitPrice: 15000 }],
    currency: "USD",
    dueDateTerms: "net_30" as const,
    allowedPaymentMethods: ["card" as const],
    feeHandling: "absorb" as const,
    taxEnabled: false,
  };
}

describe("Payment field mutations", () => {
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

    await t.run(async (ctx) => {
      await ctx.db.insert("organization_members", {
        userId: ownerId,
        organizationId,
        role: "owner",
        status: "active",
        isPrimary: true,
      });
    });

    documentId = await t.run(async (ctx) => {
      return await ctx.db.insert("documents", {
        name: "Payment Test Doc",
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

    recipientId = await t.run(async (ctx) => {
      return await ctx.db.insert("document_recipients", {
        documentId,
        email: "signer@example.com",
        name: "Test Signer",
        role: "signer",
        status: "pending",
        order: 1,
        signingToken: "test-token-mutations",
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

  describe("upsertPaymentConfig", () => {
    test("creates a new payment config", async () => {
      const configId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      expect(configId).toBeDefined();

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config).toBeDefined();
      expect(config?.paymentType).toBe("one_time");
      expect(config?.totalAmountCents).toBe(15000);
      expect(config?.currency).toBe("usd");
      expect(config?.paymentStatus).toBe("pending");
      expect(config?.documentId).toBe(documentId);
      expect(config?.organizationId).toBe(organizationId);
    });

    test("updates existing config on second upsert", async () => {
      const authed = t.withIdentity({ subject: "clerk_test_owner" });

      const firstId = await authed.mutation(
        api.payment_fields.mutations.upsertPaymentConfig,
        makeValidPaymentArgs(paymentFieldId),
      );

      const secondId = await authed.mutation(api.payment_fields.mutations.upsertPaymentConfig, {
        ...makeValidPaymentArgs(paymentFieldId),
        items: [{ id: "item-1", description: "Updated fee", quantity: 2, unitPrice: 10000 }],
      });

      expect(secondId).toBe(firstId);

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(firstId);
      });

      expect(config?.totalAmountCents).toBe(20000);
      expect(config?.items[0]?.description).toBe("Updated fee");
    });

    test("lowercases currency", async () => {
      const configId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
          ...makeValidPaymentArgs(paymentFieldId),
          currency: "USD",
        });

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config?.currency).toBe("usd");
    });

    test("rejects unauthenticated requests", async () => {
      await expect(
        t.mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        ),
      ).rejects.toThrow();
    });

    test("rejects non-payment field type", async () => {
      const textFieldId = await t.run(async (ctx) => {
        return await ctx.db.insert("signature_fields", {
          documentId,
          recipientId,
          fieldType: "text",
          label: "Name",
          isRequired: true,
          x: 10,
          y: 50,
          width: 150,
          height: 30,
          page: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(
            api.payment_fields.mutations.upsertPaymentConfig,
            makeValidPaymentArgs(textFieldId),
          ),
      ).rejects.toThrow("Field is not a payment field");
    });

    test("rejects config with empty items", async () => {
      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
            ...makeValidPaymentArgs(paymentFieldId),
            items: [],
          }),
      ).rejects.toThrow("At least one line item is required");
    });

    test("rejects amount below Stripe minimum", async () => {
      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
            ...makeValidPaymentArgs(paymentFieldId),
            items: [{ id: "item-1", description: "Tiny fee", quantity: 1, unitPrice: 10 }],
          }),
      ).rejects.toThrow("Total amount must be at least");
    });

    test("rejects recurring without config", async () => {
      await expect(
        t
          .withIdentity({ subject: "clerk_test_owner" })
          .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
            ...makeValidPaymentArgs(paymentFieldId),
            paymentType: "recurring" as const,
          }),
      ).rejects.toThrow("Recurring configuration is required");
    });

    test("accepts valid recurring config", async () => {
      const configId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
          ...makeValidPaymentArgs(paymentFieldId),
          paymentType: "recurring" as const,
          recurringConfig: {
            interval: "month" as const,
            intervalCount: 1,
            endCondition: "never" as const,
          },
        });

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config?.paymentType).toBe("recurring");
      expect(config?.recurringConfig?.interval).toBe("month");
    });
  });

  describe("deletePaymentConfig", () => {
    test("deletes existing payment config", async () => {
      const authed = t.withIdentity({ subject: "clerk_test_owner" });

      await authed.mutation(
        api.payment_fields.mutations.upsertPaymentConfig,
        makeValidPaymentArgs(paymentFieldId),
      );

      await authed.mutation(api.payment_fields.mutations.deletePaymentConfig, {
        fieldId: paymentFieldId,
      });

      const config = await t.run(async (ctx) => {
        return await ctx.db
          .query("payment_field_configs")
          .withIndex("by_field", (q) => q.eq("fieldId", paymentFieldId))
          .unique();
      });

      expect(config).toBeNull();
    });

    test("succeeds silently when no config exists", async () => {
      const result = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(api.payment_fields.mutations.deletePaymentConfig, { fieldId: paymentFieldId });

      expect(result).toEqual({ success: true });
    });
  });

  describe("updatePaymentStatus", () => {
    test("updates payment status and Stripe IDs", async () => {
      const authed = t.withIdentity({ subject: "clerk_test_owner" });

      const configId = await authed.mutation(
        api.payment_fields.mutations.upsertPaymentConfig,
        makeValidPaymentArgs(paymentFieldId),
      );

      await authed.mutation(api.payment_fields.mutations.updatePaymentStatus, {
        configId,
        paymentStatus: "created",
        stripeInvoiceId: "in_test_123",
      });

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config?.paymentStatus).toBe("created");
      expect(config?.stripeInvoiceId).toBe("in_test_123");
    });

    test("transitions through status lifecycle", async () => {
      const authed = t.withIdentity({ subject: "clerk_test_owner" });

      const configId = await authed.mutation(
        api.payment_fields.mutations.upsertPaymentConfig,
        makeValidPaymentArgs(paymentFieldId),
      );

      // pending -> created -> awaiting -> paid
      for (const status of ["created", "awaiting", "paid"] as const) {
        await authed.mutation(api.payment_fields.mutations.updatePaymentStatus, {
          configId,
          paymentStatus: status,
        });
      }

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config?.paymentStatus).toBe("paid");
    });
  });

  describe("storeStripeIds (internal)", () => {
    test("stores Stripe IDs on config", async () => {
      const configId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
          configId,
          paymentStatus: "created",
          stripeInvoiceId: "in_internal_123",
          stripePaymentIntentId: "pi_internal_456",
        });
      });

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config?.paymentStatus).toBe("created");
      expect(config?.stripeInvoiceId).toBe("in_internal_123");
      expect(config?.stripePaymentIntentId).toBe("pi_internal_456");
    });

    test("stores hostedInvoiceUrl on config", async () => {
      const configId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
          configId,
          paymentStatus: "awaiting",
          stripeInvoiceId: "in_url_test_123",
          hostedInvoiceUrl: "https://invoice.stripe.com/i/acct_123/test_456",
        });
      });

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config?.paymentStatus).toBe("awaiting");
      expect(config?.stripeInvoiceId).toBe("in_url_test_123");
      expect(config?.hostedInvoiceUrl).toBe("https://invoice.stripe.com/i/acct_123/test_456");
    });
  });

  describe("updatePaymentStatusFromSubscriptionWebhook (internal)", () => {
    test("finds config by subscriptionId and updates status", async () => {
      const configId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      // Store a subscription ID on the config
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
          configId,
          paymentStatus: "awaiting",
          stripeSubscriptionId: "sub_webhook_test_123",
        });
      });

      // Call the webhook mutation
      const result = await t.run(async (ctx) => {
        return await ctx.runMutation(
          internal.payment_fields.mutations.updatePaymentStatusFromSubscriptionWebhook,
          {
            stripeSubscriptionId: "sub_webhook_test_123",
            paymentStatus: "paid",
          },
        );
      });

      expect(result).toBe(configId);

      const config = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(config?.paymentStatus).toBe("paid");
    });

    test("returns null when no config matches", async () => {
      const result = await t.run(async (ctx) => {
        return await ctx.runMutation(
          internal.payment_fields.mutations.updatePaymentStatusFromSubscriptionWebhook,
          {
            stripeSubscriptionId: "sub_nonexistent_999",
            paymentStatus: "paid",
          },
        );
      });

      expect(result).toBeNull();
    });

    test("updates the updatedAt timestamp", async () => {
      const configId = await t
        .withIdentity({ subject: "clerk_test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeStripeIds, {
          configId,
          paymentStatus: "awaiting",
          stripeSubscriptionId: "sub_timestamp_test",
        });
      });

      const beforeUpdate = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });
      const beforeTimestamp = beforeUpdate?.updatedAt;

      // Small delay to ensure timestamp advances
      await new Promise((resolve) => setTimeout(resolve, 10));

      await t.run(async (ctx) => {
        await ctx.runMutation(
          internal.payment_fields.mutations.updatePaymentStatusFromSubscriptionWebhook,
          {
            stripeSubscriptionId: "sub_timestamp_test",
            paymentStatus: "cancelled",
          },
        );
      });

      const afterUpdate = await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      });

      expect(afterUpdate?.updatedAt).toBeGreaterThan(beforeTimestamp!);
      expect(afterUpdate?.paymentStatus).toBe("cancelled");
    });
  });
});
