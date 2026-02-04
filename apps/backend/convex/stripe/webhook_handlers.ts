/**
 * Stripe Webhook Event Handlers
 *
 * Extracted handlers for Stripe subscription and payment events
 */

import type { GenericActionCtx } from "convex/server";
import type Stripe from "stripe";

import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

type HttpActionCtx = GenericActionCtx<DataModel>;

/**
 * Stripe webhook payload for promotion codes.
 * Includes optional top-level `coupon` field that we attach after fetching from Stripe.
 */
type PromotionCodeWithCoupon = Stripe.PromotionCode & {
  coupon?: Stripe.Coupon | string | null;
};

/**
 * Extract coupon ID from a promotion code.
 * Handles both expanded coupon objects and coupon ID strings.
 */
function extractCouponIdFromPromotionCode(
  promotionCode: PromotionCodeWithCoupon,
): string | undefined {
  if (promotionCode.coupon) {
    return typeof promotionCode.coupon === "string"
      ? promotionCode.coupon
      : promotionCode.coupon.id;
  }
  return undefined;
}

async function handleSubscriptionCreated(
  ctx: HttpActionCtx,
  subscription: Stripe.Subscription,
): Promise<void> {
  await ctx.runMutation(internal.stripe.handlers.handleSubscriptionCreated, {
    subscription,
  });
}

async function handleSubscriptionUpdated(
  ctx: HttpActionCtx,
  subscription: Stripe.Subscription,
): Promise<void> {
  await ctx.runMutation(internal.stripe.handlers.handleSubscriptionUpdated, {
    subscription,
  });
}

async function handleSubscriptionDeleted(
  ctx: HttpActionCtx,
  subscription: Stripe.Subscription,
): Promise<void> {
  await ctx.runMutation(internal.stripe.handlers.handleSubscriptionDeleted, {
    subscription,
  });
}

async function handlePaymentSucceeded(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  await ctx.runMutation(internal.stripe.handlers.handlePaymentSucceeded, {
    invoice,
  });
}

async function handlePaymentFailed(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  await ctx.runMutation(internal.stripe.handlers.handlePaymentFailed, {
    invoice,
  });
}

async function handleProductOrPriceChange(ctx: HttpActionCtx): Promise<void> {
  await ctx.runAction(internal.stripe.sync.syncFromStripeWebhook);
}

async function handleProductDeleted(ctx: HttpActionCtx, obj: Stripe.DeletedProduct) {
  try {
    await ctx.runMutation(internal.stripe.sync.setProductStatus, {
      externalProductId: obj.id,
      status: "deleted",
    });
  } catch (err) {
    console.error("Failed to mark product as deleted", {
      operation: "handleProductDeleted",
      productId: obj.id,
      error: err instanceof Error ? err.message : String(err),
      willContinue: true,
    });
  }
}

async function handlePriceDeleted(ctx: HttpActionCtx, obj: Stripe.DeletedPrice) {
  try {
    await ctx.runMutation(internal.stripe.sync.setPriceStatus, {
      externalPriceId: obj.id,
      status: "deleted",
    });
  } catch (err) {
    console.error("Failed to mark price as deleted", {
      operation: "handlePriceDeleted",
      priceId: obj.id,
      error: err instanceof Error ? err.message : String(err),
      willContinue: true,
    });
  }
}

async function handleCheckoutCompleted(
  ctx: HttpActionCtx,
  session: Stripe.Checkout.Session,
): Promise<void> {
  await ctx.runMutation(internal.stripe.handlers.handleCheckoutCompleted, {
    session,
  });
}

// Coupon Handlers
async function handleCouponCreated(ctx: HttpActionCtx, coupon: Stripe.Coupon): Promise<void> {
  // Hydrate coupon to get applies_to field (not included in webhook payload)
  let hydratedCoupon: Stripe.Coupon = coupon;

  try {
    hydratedCoupon = (await ctx.runAction(internal.stripe.actions.retrieveCoupon, {
      couponId: coupon.id,
    })) as Stripe.Coupon;
  } catch (error) {
    console.error("Failed to hydrate coupon applies_to before sync", {
      operation: "handleCouponCreated",
      couponId: coupon.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await ctx.runMutation(internal.stripe.coupon.handleCouponCreatedOrUpdated, {
    coupon: hydratedCoupon,
  });
}

async function handleCouponUpdated(ctx: HttpActionCtx, coupon: Stripe.Coupon): Promise<void> {
  // Hydrate coupon to get applies_to field
  let hydratedCoupon: Stripe.Coupon = coupon;

  try {
    hydratedCoupon = (await ctx.runAction(internal.stripe.actions.retrieveCoupon, {
      couponId: coupon.id,
    })) as Stripe.Coupon;
  } catch (error) {
    console.error("Failed to hydrate coupon applies_to before sync", {
      operation: "handleCouponUpdated",
      couponId: coupon.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await ctx.runMutation(internal.stripe.coupon.handleCouponCreatedOrUpdated, {
    coupon: hydratedCoupon,
  });
}

async function handleCouponDeleted(
  ctx: HttpActionCtx,
  coupon: Stripe.DeletedCoupon,
): Promise<void> {
  await ctx.runMutation(internal.stripe.coupon.handleCouponDeleted, {
    couponId: coupon.id,
  });
}

// Promotion Code Handlers
async function handlePromotionCodeCreated(
  ctx: HttpActionCtx,
  promotionCode: PromotionCodeWithCoupon,
): Promise<void> {
  const stripeCouponId = extractCouponIdFromPromotionCode(promotionCode);

  // If coupon is missing from the webhook payload, fetch the full promotion code from Stripe
  if (!stripeCouponId) {
    console.info("Promotion code webhook missing coupon, fetching from Stripe", {
      operation: "handlePromotionCodeCreated",
      promotionCodeId: promotionCode.id,
      code: promotionCode.code,
    });

    const hydratedPromotionCode = (await ctx.runAction(
      internal.stripe.actions.retrievePromotionCode,
      { promotionCodeId: promotionCode.id },
    )) as PromotionCodeWithCoupon;

    const coupon =
      typeof hydratedPromotionCode.coupon === "object" ? hydratedPromotionCode.coupon : null;

    if (!coupon) {
      console.error("Could not resolve coupon for promotion code", {
        promotionCodeId: promotionCode.id,
      });
      return;
    }

    await ctx.runMutation(internal.stripe.promo_code.handlePromotionCodeCreatedOrUpdated, {
      promotionCode: hydratedPromotionCode,
      coupon,
    });
    return;
  }

  // Fetch the coupon to ensure we have full data
  const coupon = (await ctx.runAction(internal.stripe.actions.retrieveCoupon, {
    couponId: stripeCouponId,
  })) as Stripe.Coupon;

  await ctx.runMutation(internal.stripe.promo_code.handlePromotionCodeCreatedOrUpdated, {
    promotionCode,
    coupon,
  });
}

async function handlePromotionCodeUpdated(
  ctx: HttpActionCtx,
  promotionCode: PromotionCodeWithCoupon,
): Promise<void> {
  const stripeCouponId = extractCouponIdFromPromotionCode(promotionCode);

  // If coupon is missing, fetch the full promotion code
  if (!stripeCouponId) {
    const hydratedPromotionCode = (await ctx.runAction(
      internal.stripe.actions.retrievePromotionCode,
      { promotionCodeId: promotionCode.id },
    )) as PromotionCodeWithCoupon;

    const coupon =
      typeof hydratedPromotionCode.coupon === "object" ? hydratedPromotionCode.coupon : null;

    if (!coupon) {
      console.error("Could not resolve coupon for promotion code", {
        promotionCodeId: promotionCode.id,
      });
      return;
    }

    await ctx.runMutation(internal.stripe.promo_code.handlePromotionCodeCreatedOrUpdated, {
      promotionCode: hydratedPromotionCode,
      coupon,
    });
    return;
  }

  // Fetch the coupon to ensure we have full data
  const coupon = (await ctx.runAction(internal.stripe.actions.retrieveCoupon, {
    couponId: stripeCouponId,
  })) as Stripe.Coupon;

  await ctx.runMutation(internal.stripe.promo_code.handlePromotionCodeCreatedOrUpdated, {
    promotionCode,
    coupon,
  });
}

async function handlePromotionCodeDeleted(
  ctx: HttpActionCtx,
  promotionCode: Stripe.PromotionCode,
): Promise<void> {
  await ctx.runMutation(internal.stripe.promo_code.handlePromotionCodeDeleted, {
    promotionCodeId: promotionCode.id,
  });
}

type EventHandler = (ctx: HttpActionCtx, data: unknown) => Promise<void>;

const EVENT_HANDLERS: Record<string, EventHandler> = {
  // Subscription events
  "customer.subscription.created": (ctx, data) =>
    handleSubscriptionCreated(ctx, data as Stripe.Subscription),
  "customer.subscription.updated": (ctx, data) =>
    handleSubscriptionUpdated(ctx, data as Stripe.Subscription),
  "customer.subscription.deleted": (ctx, data) =>
    handleSubscriptionDeleted(ctx, data as Stripe.Subscription),
  // Invoice events
  "invoice.payment_succeeded": (ctx, data) => handlePaymentSucceeded(ctx, data as Stripe.Invoice),
  "invoice.payment_failed": (ctx, data) => handlePaymentFailed(ctx, data as Stripe.Invoice),
  // Checkout events
  "checkout.session.completed": (ctx, data) =>
    handleCheckoutCompleted(ctx, data as Stripe.Checkout.Session),
  // Product & Price events
  "product.created": (ctx) => handleProductOrPriceChange(ctx),
  "product.updated": (ctx) => handleProductOrPriceChange(ctx),
  "product.deleted": (ctx, data) =>
    handleProductDeleted(ctx, data as unknown as Stripe.DeletedProduct),
  "price.created": (ctx) => handleProductOrPriceChange(ctx),
  "price.updated": (ctx) => handleProductOrPriceChange(ctx),
  "price.deleted": (ctx, data) => handlePriceDeleted(ctx, data as unknown as Stripe.DeletedPrice),
  // Coupon events
  "coupon.created": (ctx, data) => handleCouponCreated(ctx, data as Stripe.Coupon),
  "coupon.updated": (ctx, data) => handleCouponUpdated(ctx, data as Stripe.Coupon),
  "coupon.deleted": (ctx, data) => handleCouponDeleted(ctx, data as Stripe.DeletedCoupon),
  // Promotion code events
  "promotion_code.created": (ctx, data) =>
    handlePromotionCodeCreated(ctx, data as PromotionCodeWithCoupon),
  "promotion_code.updated": (ctx, data) =>
    handlePromotionCodeUpdated(ctx, data as PromotionCodeWithCoupon),
  "promotion_code.deleted": (ctx, data) =>
    handlePromotionCodeDeleted(ctx, data as Stripe.PromotionCode),
};

export async function processStripeWebhookEvent(
  ctx: HttpActionCtx,
  event: Stripe.Event,
): Promise<void> {
  const handler = EVENT_HANDLERS[event.type];
  if (handler) {
    await handler(ctx, event.data.object);
  } else {
    console.warn(`Unhandled Stripe event type: ${event.type}`);
  }
}
