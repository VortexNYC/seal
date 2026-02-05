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

export const documentInvoicesTable = defineTable({
  documentId: v.id("documents"),
  organizationId: v.id("organizations"),
  stripeAccountId: v.string(),
  stripeInvoiceId: v.string(),
  stripeCustomerId: v.optional(v.string()),
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
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_document", ["documentId"])
  .index("by_stripe_invoice", ["stripeInvoiceId"])
  .index("by_organization", ["organizationId"]);
