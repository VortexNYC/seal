import { parse } from "@vortexnyc/convex/helpers";
import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

const invoiceEventArgs = {
  eventId: v.string(),
  organizationId: v.string(),
  externalCustomerId: v.string(),
  externalSubscriptionId: v.string(),
  externalPriceId: v.optional(v.string()),
  externalProductId: v.optional(v.string()),
  invoiceNumber: v.string(),
  invoiceStatus: v.string(),
  status: v.union(
    v.literal("active"),
    v.literal("past_due"),
    v.literal("canceled"),
    v.literal("trialing"),
    v.literal("paused"),
    v.literal("incomplete"),
    v.literal("incomplete_expired"),
    v.literal("unpaid")
  ),
  cancelAtPeriodEnd: v.optional(v.boolean()),
  currentPeriodStart: v.optional(v.number()),
  currentPeriodEnd: v.optional(v.number()),
  latestInvoiceStatus: v.string(),
  metadata: v.optional(v.string()),
};

export const projectInvoiceEvent = internalAction({
  args: invoiceEventArgs,
  handler: async (_ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return { projected: false };
    }

    const res = await fetch(`${url}/internal/webhooks/vortex-billing/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-api-key": key,
      },
      body: JSON.stringify({
        eventId: args.eventId,
        organizationId: args.organizationId,
        externalCustomerId: args.externalCustomerId,
        externalSubscriptionId: args.externalSubscriptionId,
        externalPriceId: args.externalPriceId,
        externalProductId: args.externalProductId,
        invoiceNumber: args.invoiceNumber,
        invoiceStatus: args.invoiceStatus,
        status: args.status,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
        currentPeriodStart: args.currentPeriodStart
          ? new Date(args.currentPeriodStart).toISOString()
          : undefined,
        currentPeriodEnd: args.currentPeriodEnd
          ? new Date(args.currentPeriodEnd).toISOString()
          : undefined,
        latestInvoiceStatus: args.latestInvoiceStatus,
        metadata: args.metadata,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Worker invoice event projection failed: ${res.status} ${text}`
      );
    }

    return { projected: true };
  },
});

const subscriptionUpdatedArgs = {
  eventId: v.string(),
  organizationId: v.string(),
  externalCustomerId: v.string(),
  externalSubscriptionId: v.string(),
  externalPriceId: v.string(),
  externalProductId: v.optional(v.string()),
  status: v.union(
    v.literal("active"),
    v.literal("past_due"),
    v.literal("canceled"),
    v.literal("trialing"),
    v.literal("paused"),
    v.literal("incomplete"),
    v.literal("incomplete_expired"),
    v.literal("unpaid")
  ),
  cancelAtPeriodEnd: v.optional(v.boolean()),
  currentPeriodStart: v.optional(v.number()),
  currentPeriodEnd: v.optional(v.number()),
  canceledAt: v.optional(v.number()),
  cancelReason: v.optional(v.string()),
  latestInvoiceId: v.optional(v.string()),
  metadata: v.optional(v.string()),
};

export const projectSubscriptionUpdated = internalAction({
  args: subscriptionUpdatedArgs,
  handler: async (_ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return { projected: false };
    }

    const res = await fetch(
      `${url}/internal/webhooks/vortex-billing/subscription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": key,
        },
        body: JSON.stringify({
          eventId: args.eventId,
          organizationId: args.organizationId,
          externalCustomerId: args.externalCustomerId,
          externalSubscriptionId: args.externalSubscriptionId,
          externalPriceId: args.externalPriceId,
          externalProductId: args.externalProductId,
          status: args.status,
          cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
          currentPeriodStart: args.currentPeriodStart,
          currentPeriodEnd: args.currentPeriodEnd,
          canceledAt: args.canceledAt,
          cancelReason: args.cancelReason,
          latestInvoiceId: args.latestInvoiceId,
          metadata: args.metadata,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Worker subscription event projection failed: ${res.status} ${text}`
      );
    }

    return { projected: true };
  },
});

const hasActiveNonVortexProviderShapedSubscriptionResponse = v.object({
  hasActive: v.boolean(),
});

export const hasActiveNonVortexProviderShapedSubscription = internalAction({
  args: {
    organizationId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const url = process.env.SIGN_API_EMAIL_URL;
    const key = process.env.SIGN_API_EMAIL_KEY;
    if (!url || !key) {
      return await ctx.runQuery(
        internal.vortex_billing.projection
          .getActiveNonVortexProviderShapedSubscriptionQuery,
        { organizationId: args.organizationId }
      );
    }

    const res = await fetch(
      `${url}/internal/organizations/${encodeURIComponent(
        args.organizationId
      )}/has-active-non-vortex-provider-subscription`,
      {
        headers: {
          "x-internal-api-key": key,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(
        `Worker has-active-non-vortex-provider-subscription failed: ${res.status} ${text}`
      );
      return await ctx.runQuery(
        internal.vortex_billing.projection
          .getActiveNonVortexProviderShapedSubscriptionQuery,
        { organizationId: args.organizationId }
      );
    }

    try {
      const body = await res.json();
      const parsed = parse(
        hasActiveNonVortexProviderShapedSubscriptionResponse,
        body
      );
      return parsed.hasActive;
    } catch (error) {
      console.error(
        "Failed to parse Worker non-Vortex subscription check:",
        error
      );
      return await ctx.runQuery(
        internal.vortex_billing.projection
          .getActiveNonVortexProviderShapedSubscriptionQuery,
        { organizationId: args.organizationId }
      );
    }
  },
});
