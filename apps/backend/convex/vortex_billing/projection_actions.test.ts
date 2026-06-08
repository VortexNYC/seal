import { describe, expect, test } from "vitest";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { mapVortexPayableStatusToSealPaymentStatus } from "../payment_fields/mutations";
import { createTestContext } from "../test.setup";

async function createPaymentConfig(t: ReturnType<typeof createTestContext>) {
  const organizationId = await t.run(async (ctx) => {
    return await ctx.db.insert("organizations", {
      name: "Vortex Projection Org",
      slug: "vortex-projection-org",
      type: "company",
      isActive: true,
      timezone: "UTC",
      updatedAt: Date.now(),
    });
  });

  const ownerId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      email: "owner@seal.test",
      name: "Owner",
      authSubject: "owner_projection",
      isEmailVerified: true,
      timezone: "UTC",
      locale: "en-US",
      activeOrganizationId: organizationId,
    });
  });

  const documentId = await t.run(async (ctx) => {
    return await ctx.db.insert("documents", {
      name: "Projection Doc",
      ownerId,
      organizationId,
      status: "active",
      workflowStatus: "waiting_for_payment",
      sharingMode: "private",
      fileSize: 1024,
      fileType: "application/pdf",
      storageId: "storage_projection",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const recipientId = await t.run(async (ctx) => {
    return await ctx.db.insert("document_recipients", {
      documentId,
      email: "buyer@seal.test",
      name: "Buyer",
      role: "signer",
      status: "signed",
      signingToken: "projection_token",
      tokenExpiresAt: Date.now() + 86_400_000,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const fieldId = await t.run(async (ctx) => {
    return await ctx.db.insert("signature_fields", {
      documentId,
      recipientId,
      fieldType: "payment",
      label: "Payment",
      isRequired: true,
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      page: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  const configId = await t.run(async (ctx) => {
    return await ctx.db.insert("payment_field_configs", {
      fieldId,
      documentId,
      organizationId,
      paymentType: "one_time",
      items: [{ id: "line_1", description: "Payment", quantity: 1, unitPrice: 4200 }],
      currency: "usd",
      dueDateTerms: "net_30",
      allowedPaymentMethods: ["card"],
      feeHandling: "absorb",
      taxEnabled: false,
      totalAmountCents: 4200,
      paymentStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return { configId, documentId };
}

async function getVortexInvoice(t: ReturnType<typeof createTestContext>, vortexPayableId: string) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("document_invoices")
      .withIndex("by_vortex_payable", (q) => q.eq("vortexPayableId", vortexPayableId))
      .unique();
  });
}

async function storeProjectionPayable(
  t: ReturnType<typeof createTestContext>,
  configId: Id<"payment_field_configs">,
) {
  await t.mutation(internal.payment_fields.mutations.storeVortexPayableLink, {
    configId,
    vortexPayableId: "payable_projection_1",
    vortexPaymentRequestId: "pr_projection_1",
    hostedInvoiceUrl: "https://billing.vortex.test/pay/projection",
    customerEmail: "buyer@seal.test",
    customerName: "Buyer",
  });
}

describe("Vortex Billing payment projection", () => {
  test("maps Vortex payable statuses into Seal payment statuses", () => {
    expect(mapVortexPayableStatusToSealPaymentStatus("awaiting_payment")).toBe("awaiting");
    expect(mapVortexPayableStatusToSealPaymentStatus("paid")).toBe("paid");
    expect(mapVortexPayableStatusToSealPaymentStatus("failed")).toBe("failed");
    expect(mapVortexPayableStatusToSealPaymentStatus("voided")).toBe("cancelled");
    expect(mapVortexPayableStatusToSealPaymentStatus("unknown_future_status")).toBeNull();
  });

  test("stores Vortex payable identity and creates dashboard invoice row", async () => {
    const t = createTestContext();
    const { configId } = await createPaymentConfig(t);

    await storeProjectionPayable(t, configId);

    const stored = await t.run(async (ctx) => {
      return await ctx.db.get(configId);
    });
    expect(stored?.paymentStatus).toBe("awaiting");
    expect(stored?.vortexPayableId).toBe("payable_projection_1");
    expect(stored?.vortexPaymentRequestId).toBe("pr_projection_1");
    expect(stored?.hostedInvoiceUrl).toBe("https://billing.vortex.test/pay/projection");
    const invoiceBefore = await getVortexInvoice(t, "payable_projection_1");
    expect(invoiceBefore?.provider).toBe("vortex_billing");
    expect(invoiceBefore?.status).toBe("open");
    expect(invoiceBefore?.stripeInvoiceId).toBeUndefined();
    expect(invoiceBefore?.stripeAccountId).toBeUndefined();
    expect(invoiceBefore?.customerEmail).toBe("buyer@seal.test");
  });

  test("projects paid Vortex status into payment config, invoice row, and document completion", async () => {
    const t = createTestContext();
    const { configId, documentId } = await createPaymentConfig(t);

    await storeProjectionPayable(t, configId);
    const invoiceBefore = await getVortexInvoice(t, "payable_projection_1");

    const result = await t.action(
      internal.vortex_billing.projection_actions.applyVortexPayableUpdated,
      {
        vortexPayableId: "payable_projection_1",
        vortexStatus: "paid",
        vortexPaymentRequestId: "pr_projection_1",
      },
    );

    expect(result?.paymentStatus).toBe("paid");
    expect(result?.invoiceRecordId).toBe(invoiceBefore?._id);

    const projected = await t.run(async (ctx) => {
      return await ctx.db.get(configId);
    });
    expect(projected?.paymentStatus).toBe("paid");
    const invoiceAfter = await t.run(async (ctx) => {
      return await ctx.db.get(invoiceBefore!._id);
    });
    expect(invoiceAfter?.status).toBe("paid");
    expect(invoiceAfter?.paidAt).toBeDefined();

    const document = await t.run(async (ctx) => {
      return await ctx.db.get(documentId as Id<"documents">);
    });
    expect(document?.workflowStatus).toBe("completed");
  });

  test("dedupes Vortex payable events by event id", async () => {
    const t = createTestContext();
    const { configId } = await createPaymentConfig(t);

    await t.mutation(internal.payment_fields.mutations.storeVortexPayableLink, {
      configId,
      vortexPayableId: "payable_projection_dedupe",
      vortexPaymentRequestId: "pr_projection_dedupe",
      customerEmail: "buyer@seal.test",
    });

    const first = await t.action(
      internal.vortex_billing.projection_actions.applyVortexPayableUpdatedEvent,
      {
        eventId: "evt_vortex_projection_dedupe",
        eventType: "payable_object.updated",
        vortexPayableId: "payable_projection_dedupe",
        vortexStatus: "paid",
        vortexPaymentRequestId: "pr_projection_dedupe",
      },
    );
    const second = await t.action(
      internal.vortex_billing.projection_actions.applyVortexPayableUpdatedEvent,
      {
        eventId: "evt_vortex_projection_dedupe",
        eventType: "payable_object.updated",
        vortexPayableId: "payable_projection_dedupe",
        vortexStatus: "paid",
        vortexPaymentRequestId: "pr_projection_dedupe",
      },
    );

    expect(first).toMatchObject({ duplicate: false, result: { paymentStatus: "paid" } });
    expect(second).toEqual({ duplicate: true, result: null });

    const processedEvents = await t.run(async (ctx) => {
      return await ctx.db.query("vortex_billing_webhook_events").collect();
    });
    expect(processedEvents).toHaveLength(1);
  });

  test("does not regress a paid Vortex payment field on stale payable status", async () => {
    const t = createTestContext();
    const { configId } = await createPaymentConfig(t);

    await t.mutation(internal.payment_fields.mutations.storeVortexPayableLink, {
      configId,
      vortexPayableId: "payable_projection_stale",
      customerEmail: "buyer@seal.test",
    });
    await t.action(internal.vortex_billing.projection_actions.applyVortexPayableUpdated, {
      vortexPayableId: "payable_projection_stale",
      vortexStatus: "paid",
    });

    const stale = await t.action(
      internal.vortex_billing.projection_actions.applyVortexPayableUpdated,
      {
        vortexPayableId: "payable_projection_stale",
        vortexStatus: "awaiting_payment",
      },
    );

    expect(stale?.paymentStatus).toBe("paid");
    const config = await t.run(async (ctx) => {
      return await ctx.db.get(configId);
    });
    expect(config?.paymentStatus).toBe("paid");
    const invoice = await getVortexInvoice(t, "payable_projection_stale");
    expect(invoice?.status).toBe("paid");
  });

  test("ignores Vortex payable statuses that Seal does not understand yet", async () => {
    const t = createTestContext();
    const { configId } = await createPaymentConfig(t);

    await t.mutation(internal.payment_fields.mutations.storeVortexPayableLink, {
      configId,
      vortexPayableId: "payable_projection_unknown",
      customerEmail: "buyer@seal.test",
    });

    const result = await t.mutation(
      internal.payment_fields.mutations.updatePaymentStatusFromVortexPayable,
      {
        vortexPayableId: "payable_projection_unknown",
        vortexStatus: "future_status",
      },
    );

    expect(result).toBeNull();
    const config = await t.run(async (ctx) => {
      return await ctx.db.get(configId);
    });
    expect(config?.paymentStatus).toBe("awaiting");
  });
});
