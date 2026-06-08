import { defineTable } from "convex/server";
import { v } from "convex/values";

export const documentInvoiceStatusTuple = v.union(
  v.literal("draft"),
  v.literal("open"),
  v.literal("paid"),
  v.literal("void"),
  v.literal("uncollectible"),
  v.literal("deleted"),
);

export const dunningStatusTuple = v.union(
  v.literal("none"),
  v.literal("active"),
  v.literal("completed"),
  v.literal("cancelled"),
);

export const documentInvoicesTable = defineTable({
  documentId: v.id("documents"),
  organizationId: v.id("organizations"),
  provider: v.optional(v.union(v.literal("stripe"), v.literal("vortex_billing"))),
  stripeAccountId: v.optional(v.string()),
  stripeInvoiceId: v.optional(v.string()),
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  vortexPayableId: v.optional(v.string()),
  vortexPaymentRequestId: v.optional(v.string()),
  status: documentInvoiceStatusTuple,
  customerEmail: v.string(),
  customerName: v.optional(v.string()),
  amountDue: v.number(),
  currency: v.string(),
  hostedInvoiceUrl: v.optional(v.string()),
  invoicePdf: v.optional(v.string()),
  finalizedAt: v.optional(v.number()),
  paidAt: v.optional(v.number()),
  voidedAt: v.optional(v.number()),
  deletedAt: v.optional(v.number()),
  // Dunning (payment recovery) fields
  dunningStatus: v.optional(dunningStatusTuple),
  dunningStep: v.optional(v.number()),
  dunningStartedAt: v.optional(v.number()),
  lastDunningEmailAt: v.optional(v.number()),
  nextDunningAt: v.optional(v.number()),
  dunningCompletedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_stripe_invoice", ["stripeInvoiceId"])
  .index("by_vortex_payable", ["vortexPayableId"])
  .index("by_organization", ["organizationId"])
  .index("by_stripe_subscription", ["stripeSubscriptionId"])
  .index("by_dunning_status", ["dunningStatus", "nextDunningAt"]);
