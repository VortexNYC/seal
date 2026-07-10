import { beforeEach, describe, expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { createTestContext } from "../test.setup";
import { seedTestOrganizationMember } from "../testVortexAuth";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

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
        authSubject: "test_owner",
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
        .withIdentity({ subject: "test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      expect(configId).toBeDefined();

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config).toBeDefined();
      expect(config?.paymentType).toBe("one_time");
      expect(config?.totalAmountCents).toBe(15000);
      expect(config?.currency).toBe("usd");
      expect(config?.paymentStatus).toBe("pending");
      expect(config?.documentId).toBe(documentId);
      expect(config?.organizationId).toBe(organizationId);
    });

    test("updates existing config on second upsert", async () => {
      const authed = t.withIdentity({ subject: "test_owner" });

      const firstId = await authed.mutation(
        api.payment_fields.mutations.upsertPaymentConfig,
        makeValidPaymentArgs(paymentFieldId),
      );

      const secondId = await authed.mutation(api.payment_fields.mutations.upsertPaymentConfig, {
        ...makeValidPaymentArgs(paymentFieldId),
        items: [{ id: "item-1", description: "Updated fee", quantity: 2, unitPrice: 10000 }],
      });

      expect(secondId).toBe(firstId);

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(firstId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.totalAmountCents).toBe(20000);
      expect(config?.items[0]?.description).toBe("Updated fee");
    });

    test("lowercases currency", async () => {
      const configId = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
          ...makeValidPaymentArgs(paymentFieldId),
          currency: "USD",
        });

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.currency).toBe("usd");
    });

    test("accepts Vortex Billing linkage fields without provider IDs", async () => {
      const now = Date.now();

      const configId = await t.run(async (ctx) => {
        return await ctx.db.insert("payment_field_configs", {
          fieldId: paymentFieldId,
          documentId,
          organizationId,
          paymentType: "one_time",
          items: [
            {
              id: "seal_line_send_flow_test",
              description: "Vortex send-flow proof payment",
              quantity: 1,
              unitPrice: 4200,
            },
          ],
          currency: "usd",
          dueDateTerms: "net_30",
          allowedPaymentMethods: ["card"],
          feeHandling: "absorb",
          taxEnabled: false,
          totalAmountCents: 4200,
          paymentStatus: "awaiting",
          hostedInvoiceUrl: "https://notable-leopard-969.convex.site/pay/pay_test",
          vortexPayableId: "payable_test",
          vortexDepositBalancePayableId: "installment_payable_test",
          vortexInstallmentPayableId: "installment_payable_test",
          vortexRecurringPayableId: "recurring_payable_test",
          vortexPaymentRequestId: "preq_test",
          createdAt: now,
          updatedAt: now,
        });
      });

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.providerInvoiceId).toBeUndefined();
      expect(config?.vortexPayableId).toBe("payable_test");
      expect(config?.vortexDepositBalancePayableId).toBe("installment_payable_test");
      expect(config?.vortexInstallmentPayableId).toBe("installment_payable_test");
      expect(config?.vortexRecurringPayableId).toBe("recurring_payable_test");
      expect(config?.vortexPaymentRequestId).toBe("preq_test");
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
          .withIdentity({ subject: "test_owner" })
          .mutation(
            api.payment_fields.mutations.upsertPaymentConfig,
            makeValidPaymentArgs(textFieldId),
          ),
      ).rejects.toThrow("Field is not a payment field");
    });

    test("rejects config with empty items", async () => {
      await expect(
        t
          .withIdentity({ subject: "test_owner" })
          .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
            ...makeValidPaymentArgs(paymentFieldId),
            items: [],
          }),
      ).rejects.toThrow("At least one line item is required");
    });

    test("rejects amount below provider minimum", async () => {
      await expect(
        t
          .withIdentity({ subject: "test_owner" })
          .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
            ...makeValidPaymentArgs(paymentFieldId),
            items: [{ id: "item-1", description: "Tiny fee", quantity: 1, unitPrice: 10 }],
          }),
      ).rejects.toThrow("Total amount must be at least");
    });

    test("rejects recurring without config", async () => {
      await expect(
        t
          .withIdentity({ subject: "test_owner" })
          .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
            ...makeValidPaymentArgs(paymentFieldId),
            paymentType: "recurring" as const,
          }),
      ).rejects.toThrow("Recurring configuration is required");
    });

    test("accepts valid recurring config", async () => {
      const configId = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(api.payment_fields.mutations.upsertPaymentConfig, {
          ...makeValidPaymentArgs(paymentFieldId),
          paymentType: "recurring" as const,
          recurringConfig: {
            interval: "month" as const,
            intervalCount: 1,
            endCondition: "never" as const,
          },
        });

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.paymentType).toBe("recurring");
      expect(config?.recurringConfig?.interval).toBe("month");
    });
  });

  describe("deletePaymentConfig", () => {
    test("deletes existing payment config", async () => {
      const authed = t.withIdentity({ subject: "test_owner" });

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
        .withIdentity({ subject: "test_owner" })
        .mutation(api.payment_fields.mutations.deletePaymentConfig, { fieldId: paymentFieldId });

      expect(result).toEqual({ success: true });
    });
  });

  describe("updatePaymentStatus", () => {
    test("updates payment status and provider IDs", async () => {
      const authed = t.withIdentity({ subject: "test_owner" });

      const configId = await authed.mutation(
        api.payment_fields.mutations.upsertPaymentConfig,
        makeValidPaymentArgs(paymentFieldId),
      );

      await authed.mutation(api.payment_fields.mutations.updatePaymentStatus, {
        configId,
        paymentStatus: "created",
        providerInvoiceId: "in_test_123",
      });

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.paymentStatus).toBe("created");
      expect(config?.providerInvoiceId).toBe("in_test_123");
    });

    test("transitions through status lifecycle", async () => {
      const authed = t.withIdentity({ subject: "test_owner" });

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

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.paymentStatus).toBe("paid");
    });
  });

  describe("storeProviderPaymentIds (internal)", () => {
    test("stores provider IDs on config", async () => {
      const configId = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeProviderPaymentIds, {
          configId,
          paymentStatus: "created",
          providerInvoiceId: "in_internal_123",
          providerPaymentIntentId: "pi_internal_456",
        });
      });

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.paymentStatus).toBe("created");
      expect(config?.providerInvoiceId).toBe("in_internal_123");
      expect(config?.providerPaymentIntentId).toBe("pi_internal_456");
    });

    test("stores hostedInvoiceUrl on config", async () => {
      const configId = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeProviderPaymentIds, {
          configId,
          paymentStatus: "awaiting",
          providerInvoiceId: "in_url_test_123",
          hostedInvoiceUrl: "https://billing.vortex.test/i/acct_123/test_456",
        });
      });

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.paymentStatus).toBe("awaiting");
      expect(config?.providerInvoiceId).toBe("in_url_test_123");
      expect(config?.hostedInvoiceUrl).toBe("https://billing.vortex.test/i/acct_123/test_456");
    });
  });

  describe("storeVortexPayableIds (internal)", () => {
    test("stores Vortex payable IDs and creates one document invoice record", async () => {
      const configId = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableIds, {
          configId,
          paymentStatus: "awaiting",
          vortexPayableId: "payable_vortex_123",
          vortexRecurringPayableId: "recurring_payable_vortex_123",
          vortexInstallmentPayableId: "installment_payable_vortex_123",
          vortexDepositBalancePayableId: "deposit_balance_payable_vortex_123",
          vortexPaymentRequestId: "pr_vortex_123",
          hostedInvoiceUrl: "https://payments.vortex.test/pay/token_123",
          customerEmail: "signer@example.com",
          customerName: "Test Signer",
        });
        await ctx.runMutation(internal.payment_fields.mutations.storeVortexPayableIds, {
          configId,
          paymentStatus: "awaiting",
          vortexPayableId: "payable_vortex_123",
          vortexPaymentRequestId: "pr_vortex_123",
          hostedInvoiceUrl: "https://payments.vortex.test/pay/token_456",
          customerEmail: "signer@example.com",
          customerName: "Test Signer",
        });
      });

      const result = await t.run(async (ctx) => {
        const config = await ctx.db.get(configId);
        const invoices = await ctx.db
          .query("document_invoices")
          .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", "payable_vortex_123"))
          .collect();
        return { config, invoices };
      });

      expect(result.config?.paymentStatus).toBe("awaiting");
      expect(result.config?.vortexPayableId).toBe("payable_vortex_123");
      expect(result.config?.vortexRecurringPayableId).toBe("recurring_payable_vortex_123");
      expect(result.config?.vortexInstallmentPayableId).toBe("installment_payable_vortex_123");
      expect(result.config?.vortexDepositBalancePayableId).toBe(
        "deposit_balance_payable_vortex_123",
      );
      expect(result.config?.vortexPaymentRequestId).toBe("pr_vortex_123");
      expect(result.config?.hostedInvoiceUrl).toBe("https://payments.vortex.test/pay/token_456");
      expect(result.invoices).toHaveLength(1);
      expect(sealAssertPresent(result.invoices[0])).toMatchObject({
        documentId,
        organizationId,
        provider: "vortex_billing",
        vortexPayableId: "payable_vortex_123",
        vortexPaymentRequestId: "pr_vortex_123",
        status: "open",
        customerEmail: "signer@example.com",
        customerName: "Test Signer",
        amountDue: 15000,
        currency: "usd",
        hostedInvoiceUrl: "https://payments.vortex.test/pay/token_456",
      });
    });
  });

  describe("updatePaymentStatusFromProviderSubscription (internal)", () => {
    test("finds config by subscriptionId and updates status", async () => {
      const configId = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      // Store a subscription ID on the config
      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeProviderPaymentIds, {
          configId,
          paymentStatus: "awaiting",
          providerSubscriptionId: "sub_webhook_test_123",
        });
      });

      // Call the webhook mutation
      const result = await t.run(async (ctx) => {
        return await ctx.runMutation(
          internal.payment_fields.mutations.updatePaymentStatusFromProviderSubscription,
          {
            providerSubscriptionId: "sub_webhook_test_123",
            paymentStatus: "paid",
          },
        );
      });

      expect(result).toBe(configId);

      const config = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(config?.paymentStatus).toBe("paid");
    });

    test("returns null when no config matches", async () => {
      const result = await t.run(async (ctx) => {
        return await ctx.runMutation(
          internal.payment_fields.mutations.updatePaymentStatusFromProviderSubscription,
          {
            providerSubscriptionId: "sub_nonexistent_999",
            paymentStatus: "paid",
          },
        );
      });

      expect(result).toBeNull();
    });

    test("updates the updatedAt timestamp", async () => {
      const configId = await t
        .withIdentity({ subject: "test_owner" })
        .mutation(
          api.payment_fields.mutations.upsertPaymentConfig,
          makeValidPaymentArgs(paymentFieldId),
        );

      await t.run(async (ctx) => {
        await ctx.runMutation(internal.payment_fields.mutations.storeProviderPaymentIds, {
          configId,
          paymentStatus: "awaiting",
          providerSubscriptionId: "sub_timestamp_test",
        });
      });

      const beforeUpdate = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;
      const beforeTimestamp = beforeUpdate?.updatedAt;

      // Small delay to ensure timestamp advances
      await new Promise((resolve) => setTimeout(resolve, 10));

      await t.run(async (ctx) => {
        await ctx.runMutation(
          internal.payment_fields.mutations.updatePaymentStatusFromProviderSubscription,
          {
            providerSubscriptionId: "sub_timestamp_test",
            paymentStatus: "cancelled",
          },
        );
      });

      const afterUpdate = (await t.run(async (ctx) => {
        return await ctx.db.get(configId);
      })) as Doc<"payment_field_configs"> | null;

      expect(afterUpdate?.updatedAt).toBeGreaterThan(sealAssertPresent(beforeTimestamp));
      expect(afterUpdate?.paymentStatus).toBe("cancelled");
    });
  });
});
