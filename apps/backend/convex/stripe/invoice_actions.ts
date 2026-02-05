"use node";

import { ConvexError, v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

async function authorizeDocumentOwner(
  ctx: ActionCtx,
  documentId: Id<"documents">,
): Promise<{ documentId: Id<"documents">; organizationId: Id<"organizations"> }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.runQuery(internal.organizations.helpers.getUserByClerkId, {
    clerkId: identity.subject,
  });

  if (!user) {
    throw new ConvexError("User not found");
  }

  const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
    documentId,
  });

  if (!document) {
    throw new ConvexError("Document not found");
  }

  if (document.ownerId !== user._id) {
    throw new ConvexError("Only the document owner can perform this action");
  }

  const membership = await ctx.runQuery(
    internal.organizations.helpers.getActiveMembershipByUserAndOrganization,
    {
      userId: user._id,
      organizationId: document.organizationId,
    },
  );

  if (!membership) {
    throw new ConvexError("You don't have access to this document");
  }

  return { documentId: document._id, organizationId: document.organizationId };
}

async function resolveConnectedAccount(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<{ stripeAccountId: string }> {
  const account = await ctx.runQuery(internal.stripe.connect_mutations.getAccountByOrganizationId, {
    organizationId,
  });

  if (!account) {
    throw new ConvexError("Stripe account not connected");
  }

  if (!account.chargesEnabled) {
    throw new ConvexError("Stripe account is not enabled for charges");
  }

  return { stripeAccountId: account.stripeAccountId };
}

function assertAmount(amountCents: number) {
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new ConvexError("Invoice amount must be greater than zero");
  }
}

export const createDraftInvoiceForDocument = action({
  args: {
    documentId: v.id("documents"),
    recipientEmail: v.string(),
    recipientName: v.optional(v.string()),
    description: v.string(),
    amountCents: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAmount(args.amountCents);

    const { organizationId } = await authorizeDocumentOwner(ctx, args.documentId);
    const { stripeAccountId } = await resolveConnectedAccount(ctx, organizationId);

    const stripe = initializeStripe();

    const existingDraft = await ctx.runQuery(
      internal.stripe.invoice_mutations.getDraftInvoiceByDocument,
      {
        documentId: args.documentId,
      },
    );

    if (existingDraft) {
      try {
        await stripe.invoices.del(existingDraft.stripeInvoiceId, {
          stripeAccount: stripeAccountId,
        });
      } catch (error) {
        console.warn("Failed to delete existing draft invoice", {
          stripeInvoiceId: existingDraft.stripeInvoiceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await ctx.runMutation(internal.stripe.invoice_mutations.markInvoiceDeleted, {
        stripeInvoiceId: existingDraft.stripeInvoiceId,
      });
    }

    const customer = await stripe.customers.create(
      {
        email: args.recipientEmail,
        name: args.recipientName ?? undefined,
      },
      { stripeAccount: stripeAccountId },
    );

    await stripe.invoiceItems.create(
      {
        customer: customer.id,
        amount: args.amountCents,
        currency: (args.currency ?? "usd").toLowerCase(),
        description: args.description,
      },
      { stripeAccount: stripeAccountId },
    );

    const invoice = await stripe.invoices.create(
      {
        customer: customer.id,
        collection_method: "send_invoice",
        days_until_due: 7,
        auto_advance: false,
        metadata: {
          documentId: args.documentId,
          organizationId,
        },
      },
      { stripeAccount: stripeAccountId },
    );

    const expandedInvoice = await stripe.invoices.retrieve(
      invoice.id,
      { expand: ["lines"] },
      { stripeAccount: stripeAccountId },
    );

    await ctx.runMutation(internal.stripe.invoice_mutations.upsertInvoiceRecord, {
      documentId: args.documentId,
      organizationId,
      stripeAccountId,
      stripeInvoiceId: expandedInvoice.id,
      status: expandedInvoice.status ?? "draft",
      customerEmail: args.recipientEmail,
      customerName: args.recipientName,
      amountDue: expandedInvoice.amount_due ?? args.amountCents,
      currency: expandedInvoice.currency ?? args.currency ?? "usd",
      hostedInvoiceUrl: expandedInvoice.hosted_invoice_url ?? undefined,
      invoicePdf: expandedInvoice.invoice_pdf ?? undefined,
    });

    return {
      stripeInvoiceId: expandedInvoice.id,
      status: expandedInvoice.status,
      amountDue: expandedInvoice.amount_due,
      currency: expandedInvoice.currency,
      lines: expandedInvoice.lines?.data?.map((line) => ({
        id: line.id,
        description: line.description ?? "",
        quantity: line.quantity ?? null,
        amount: line.amount ?? 0,
        currency: line.currency ?? args.currency ?? "usd",
      })),
    };
  },
});

export const getInvoicePreview = action({
  args: {
    documentId: v.id("documents"),
    stripeInvoiceId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await authorizeDocumentOwner(ctx, args.documentId);
    const { stripeAccountId } = await resolveConnectedAccount(ctx, organizationId);

    const stripe = initializeStripe();
    const invoice = await stripe.invoices.retrieve(
      args.stripeInvoiceId,
      { expand: ["lines"] },
      { stripeAccount: stripeAccountId },
    );

    return {
      stripeInvoiceId: invoice.id,
      status: invoice.status,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      lines: invoice.lines?.data?.map((line) => ({
        id: line.id,
        description: line.description ?? "",
        quantity: line.quantity ?? null,
        amount: line.amount ?? 0,
        currency: line.currency ?? invoice.currency ?? "usd",
      })),
    };
  },
});

export const finalizeInvoiceForDocumentInternal = internalAction({
  args: {
    documentId: v.id("documents"),
    stripeInvoiceId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await authorizeDocumentOwner(ctx, args.documentId);
    const { stripeAccountId } = await resolveConnectedAccount(ctx, organizationId);

    const stripe = initializeStripe();
    const invoice = await stripe.invoices.finalizeInvoice(
      args.stripeInvoiceId,
      { auto_advance: false },
      { stripeAccount: stripeAccountId },
    );

    await ctx.runMutation(internal.stripe.invoice_mutations.upsertInvoiceRecord, {
      documentId: args.documentId,
      organizationId,
      stripeAccountId,
      stripeInvoiceId: invoice.id,
      status: invoice.status ?? "open",
      customerEmail: invoice.customer_email ?? "",
      customerName: invoice.customer_name ?? undefined,
      amountDue: invoice.amount_due ?? 0,
      currency: invoice.currency ?? "usd",
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
      invoicePdf: invoice.invoice_pdf ?? undefined,
      finalizedAt: Date.now(),
    });

    return {
      stripeInvoiceId: invoice.id,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status,
      customerEmail: invoice.customer_email ?? undefined,
    };
  },
});

export const deleteDraftInvoice = action({
  args: {
    documentId: v.id("documents"),
    stripeInvoiceId: v.string(),
  },
  handler: async (ctx, args) => {
    const { organizationId } = await authorizeDocumentOwner(ctx, args.documentId);
    const { stripeAccountId } = await resolveConnectedAccount(ctx, organizationId);

    const stripe = initializeStripe();

    try {
      await stripe.invoices.del(args.stripeInvoiceId, { stripeAccount: stripeAccountId });
    } catch (error) {
      console.warn("Failed to delete Stripe invoice", {
        stripeInvoiceId: args.stripeInvoiceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await ctx.runMutation(internal.stripe.invoice_mutations.markInvoiceDeleted, {
      stripeInvoiceId: args.stripeInvoiceId,
    });

    return { success: true };
  },
});
