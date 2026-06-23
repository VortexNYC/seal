import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { SubscriptionStatus } from "../schemas/subscriptions";

export type VortexSubscriptionProjectionResult = {
  readonly processed: boolean;
  readonly duplicate: boolean;
  readonly organizationId: Id<"organizations">;
  readonly externalSubscriptionId: string;
  readonly activeStripeIdPresent: boolean;
};

const stripeIdPattern = /^(cus|sub|price|prod)_/u;

function mapVortexStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return status;
    case "draft":
      return "incomplete";
    case "paused":
      return "past_due";
    default:
      throw new Error(`Unsupported Vortex subscription status: ${status}`);
  }
}

function parseIsoMillis(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid Vortex subscription ${label}: ${value}`);
  }
  return parsed;
}

function parseOptionalIsoMillis(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseIsoMillis(value, "timestamp");
}

function isPaidStatus(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

async function cancelOtherPaidSubscriptions(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  externalSubscriptionId: string,
  now: number,
): Promise<void> {
  const activeSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    )
    .collect();
  const trialingSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "trialing"),
    )
    .collect();

  for (const subscription of [...activeSubscriptions, ...trialingSubscriptions]) {
    if (subscription.externalSubscriptionId === externalSubscriptionId) {
      continue;
    }
    await ctx.db.patch(subscription._id, {
      status: "canceled",
      canceledAt: now,
      cancelReason: "replaced_by_vortex_billing_subscription",
      updatedAt: now,
    });
  }
}

async function hasActiveStripeShapedSubscription(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  const activeSubscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", organizationId).eq("status", "active"),
    )
    .collect();

  return activeSubscriptions.some(
    (subscription) =>
      stripeIdPattern.test(subscription.externalCustomerId) ||
      stripeIdPattern.test(subscription.externalSubscriptionId) ||
      stripeIdPattern.test(subscription.externalPriceId),
  );
}

export const projectSubscriptionUpdated = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.literal("subscription.updated"),
    sealOrganizationId: v.id("organizations"),
    subscriptionExternalId: v.string(),
    customerExternalId: v.string(),
    planCode: v.string(),
    status: v.string(),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodStart: v.string(),
    currentPeriodEnd: v.string(),
    canceledAt: v.optional(v.string()),
    cancelReason: v.optional(v.string()),
    latestInvoiceId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<VortexSubscriptionProjectionResult> => {
    const existingEvent = await ctx.db
      .query("vortex_billing_webhook_events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
    if (existingEvent) {
      return {
        processed: false,
        duplicate: true,
        organizationId: args.sealOrganizationId,
        externalSubscriptionId: args.subscriptionExternalId,
        activeStripeIdPresent: await hasActiveStripeShapedSubscription(
          ctx,
          args.sealOrganizationId,
        ),
      };
    }

    const organization = await ctx.db.get(args.sealOrganizationId);
    if (!organization) {
      throw new Error(`Seal organization not found for Vortex webhook: ${args.sealOrganizationId}`);
    }

    const price = await ctx.db
      .query("subscription_prices")
      .withIndex("by_external_price_id", (q) => q.eq("externalPriceId", args.planCode))
      .first();
    if (!price) {
      throw new Error(`Seal subscription price not found for Vortex planCode: ${args.planCode}`);
    }

    const status = mapVortexStatus(args.status);
    const now = Date.now();
    const projection = {
      organizationId: args.sealOrganizationId,
      externalCustomerId: args.customerExternalId,
      externalSubscriptionId: args.subscriptionExternalId,
      externalPriceId: args.planCode,
      status,
      currentPeriodStart: parseIsoMillis(args.currentPeriodStart, "currentPeriodStart"),
      currentPeriodEnd: parseIsoMillis(args.currentPeriodEnd, "currentPeriodEnd"),
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      canceledAt: parseOptionalIsoMillis(args.canceledAt),
      cancelReason: args.cancelReason,
      latestInvoiceId: args.latestInvoiceId,
      updatedAt: now,
    };

    const existingSubscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_external_subscription_id", (q) =>
        q.eq("externalSubscriptionId", args.subscriptionExternalId),
      )
      .first();

    if (existingSubscription) {
      await ctx.db.patch(existingSubscription._id, projection);
      if (isPaidStatus(status)) {
        await cancelOtherPaidSubscriptions(
          ctx,
          args.sealOrganizationId,
          args.subscriptionExternalId,
          now,
        );
      } else if (isPaidStatus(existingSubscription.status) && existingSubscription.organizationId) {
        await ctx.scheduler.runAfter(0, internal.webhooks.delivery.abandonPendingDeliveriesForOrg, {
          organizationId: existingSubscription.organizationId,
        });
      }
    } else {
      await ctx.db.insert("subscriptions", {
        ...projection,
        createdAt: now,
      });
      if (isPaidStatus(status)) {
        await cancelOtherPaidSubscriptions(
          ctx,
          args.sealOrganizationId,
          args.subscriptionExternalId,
          now,
        );
      }
    }

    await ctx.db.insert("vortex_billing_webhook_events", {
      eventId: args.eventId,
      eventType: args.eventType,
      processedAt: now,
    });

    return {
      processed: true,
      duplicate: false,
      organizationId: args.sealOrganizationId,
      externalSubscriptionId: args.subscriptionExternalId,
      activeStripeIdPresent: await hasActiveStripeShapedSubscription(ctx, args.sealOrganizationId),
    };
  },
});
