import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalMutation } from "../_generated/server";

type VortexBillingSaasEnv = {
  readonly apiBaseUrl: string;
  readonly apiKey: string;
  readonly defaultBillingAccountId: string | undefined;
  readonly billingAccountMap: ReadonlyMap<string, string>;
};

type VortexBillingSaasEnvInput = {
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
  readonly defaultBillingAccountId?: string;
  readonly billingAccountMapJson?: string;
};

type VortexCheckoutSessionResult = {
  readonly checkoutSessionId: string;
  readonly checkoutUrl: string;
  readonly subscriptionExternalId: string;
};

type VortexRequestOptions = {
  readonly env: VortexBillingSaasEnv;
  readonly idempotencyKey: string;
};

function readRequiredEnv(name: string, value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    throw new ConvexError(`${name} is required for Vortex Billing subscription checkout`);
  }
  return value.trim();
}

function parseStringMap(name: string, raw: string | undefined): ReadonlyMap<string, string> {
  if (raw === undefined || raw.trim().length === 0) {
    return new Map();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ConvexError(`${name} must be valid JSON`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConvexError(`${name} must be a JSON object`);
  }

  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ConvexError(`${name}.${key} must be a non-empty string`);
    }
    entries.push([key, value.trim()]);
  }

  return new Map(entries);
}

export function readVortexBillingSaasEnv(input: VortexBillingSaasEnvInput): VortexBillingSaasEnv {
  return {
    apiBaseUrl: readRequiredEnv("VORTEX_BILLING_API_BASE_URL", input.apiBaseUrl).replace(
      /\/+$/,
      "",
    ),
    apiKey: readRequiredEnv("VORTEX_BILLING_API_KEY", input.apiKey),
    defaultBillingAccountId:
      input.defaultBillingAccountId !== undefined && input.defaultBillingAccountId.trim().length > 0
        ? input.defaultBillingAccountId.trim()
        : undefined,
    billingAccountMap: parseStringMap("VORTEX_BILLING_ACCOUNT_MAP", input.billingAccountMapJson),
  };
}

function resolveAuthContext(ctx: ActionCtx): Promise<{
  readonly user: Doc<"users">;
  readonly organization: Doc<"organizations">;
}> {
  return resolveAuthenticatedOrganization(ctx);
}

async function resolveAuthenticatedOrganization(ctx: ActionCtx): Promise<{
  readonly user: Doc<"users">;
  readonly organization: Doc<"organizations">;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user: Doc<"users"> | null = await ctx.runQuery(
    internal.organizations.helpers.getUserByAuthSubject,
    { authSubject: identity.subject },
  );
  if (!user) {
    throw new ConvexError("User not found");
  }
  if (!user.activeOrganizationId) {
    throw new ConvexError("No active organization");
  }

  const organization: Doc<"organizations"> | null = await ctx.runQuery(
    internal.organizations.helpers.getOrganizationById,
    { organizationId: user.activeOrganizationId },
  );
  if (!organization) {
    throw new ConvexError("Organization not found");
  }

  return { user, organization };
}

export function buildVortexCustomerId(organizationId: Id<"organizations">): string {
  return `vtx_cust_seal_org_${organizationId}`;
}

export function buildVortexSubscriptionId(
  organizationId: Id<"organizations">,
  lookupKey: string,
): string {
  const normalizedLookupKey = lookupKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `vtx_sub_seal_org_${organizationId}_${normalizedLookupKey}`;
}

function resolveBillingAccountId(
  env: VortexBillingSaasEnv,
  organizationId: Id<"organizations">,
): string | undefined {
  return env.billingAccountMap.get(organizationId) ?? env.defaultBillingAccountId;
}

async function requestVortexJson(
  method: "POST" | "PUT",
  path: string,
  body: Record<string, unknown>,
  options: VortexRequestOptions,
): Promise<unknown> {
  const response = await fetch(`${options.env.apiBaseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.env.apiKey}`,
      "idempotency-key": options.idempotencyKey,
      "x-vortex-service": "billing",
    },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json()) as unknown;
  if (!response.ok) {
    throw new ConvexError(
      `Vortex Billing request failed with ${response.status}: ${JSON.stringify(parsed)}`,
    );
  }
  return parsed;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function readVortexCheckoutSessionResult(value: unknown): VortexCheckoutSessionResult {
  if (!isJsonObject(value) || !isJsonObject(value.data) || !isJsonObject(value.data.checkoutSession)) {
    throw new ConvexError("Vortex checkout response did not include data.checkoutSession");
  }

  const checkoutSession = value.data.checkoutSession;
  const checkoutSessionId = checkoutSession.checkoutSessionId;
  const checkoutUrl = checkoutSession.checkoutUrl;
  const subscriptionExternalId = checkoutSession.subscriptionExternalId;

  if (typeof checkoutSessionId !== "string" || checkoutSessionId.length === 0) {
    throw new ConvexError("Vortex checkout response did not include checkoutSessionId");
  }
  if (typeof checkoutUrl !== "string" || checkoutUrl.length === 0) {
    throw new ConvexError("Vortex checkout response did not include checkoutUrl");
  }
  if (typeof subscriptionExternalId !== "string" || subscriptionExternalId.length === 0) {
    throw new ConvexError("Vortex checkout response did not include subscriptionExternalId");
  }

  return {
    checkoutSessionId,
    checkoutUrl,
    subscriptionExternalId,
  };
}

export const createCheckoutSession = action({
  args: {
    lookupKey: v.string(),
  },
  handler: async (ctx, { lookupKey }): Promise<VortexCheckoutSessionResult> => {
    const env = readVortexBillingSaasEnv({
      apiBaseUrl: process.env.VORTEX_BILLING_API_BASE_URL,
      apiKey: process.env.VORTEX_BILLING_API_KEY,
      defaultBillingAccountId: process.env.VORTEX_BILLING_ACCOUNT_ID,
      billingAccountMapJson: process.env.VORTEX_BILLING_ACCOUNT_MAP,
    });
    const { user, organization } = await resolveAuthContext(ctx);
    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      { lookupKey },
    );
    if (!priceData?.price) {
      throw new ConvexError(`Price not found for lookup key: ${lookupKey}`);
    }

    const customerExternalId = buildVortexCustomerId(organization._id);
    const subscriptionExternalId = buildVortexSubscriptionId(organization._id, lookupKey);
    const billingAccountId = resolveBillingAccountId(env, organization._id);

    await requestVortexJson(
      "PUT",
      `/v1/customers/${encodeURIComponent(customerExternalId)}`,
      {
        email: user.email,
        name: organization.name,
        billingCurrency: priceData.price.currency.toUpperCase(),
        metadata: {
          sourceSystem: "seal",
          sealOrganizationId: organization._id,
          sealOrganizationSlug: organization.slug,
        },
      },
      {
        env,
        idempotencyKey: `seal:${organization._id}:vortex-saas-customer`,
      },
    );

    const checkoutResponse = await requestVortexJson(
      "POST",
      "/v1/checkout/sessions",
      {
        mode: "subscription",
        customerExternalId,
        ...(billingAccountId !== undefined ? { billingAccountId } : {}),
        subscriptionExternalId,
        collectionMode: "automatic",
        lineItems: [{ priceId: priceData.price.externalPriceId, quantity: 1 }],
        createdByRef: "seal-vortex-saas-billing",
        metadata: {
          sourceSystem: "seal",
          sealOrganizationId: organization._id,
          sealOrganizationSlug: organization.slug,
          lookupKey,
        },
      },
      {
        env,
        idempotencyKey: `seal:${organization._id}:${lookupKey}:vortex-saas-checkout`,
      },
    );

    return readVortexCheckoutSessionResult(checkoutResponse);
  },
});

export const migrateCatalogPriceToVortex = internalMutation({
  args: {
    lookupKey: v.string(),
    externalProductId: v.string(),
    externalPriceId: v.string(),
    productName: v.string(),
    tier: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    unitAmount: v.number(),
    currency: v.string(),
    features: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const price = await ctx.db
      .query("subscription_prices")
      .withIndex("by_lookup_key", (q) => q.eq("lookupKey", args.lookupKey))
      .first();
    if (price === null) {
      throw new ConvexError(`Price not found for lookup key: ${args.lookupKey}`);
    }

    const existingProduct = await ctx.db.get(price.subscriptionProductId);
    if (existingProduct === null) {
      throw new ConvexError(`Product not found for lookup key: ${args.lookupKey}`);
    }

    await ctx.db.patch(existingProduct._id, {
      externalProductId: args.externalProductId,
      name: args.productName,
      metadata: {
        ...existingProduct.metadata,
        tier: args.tier,
        ...(args.features !== undefined ? { features: args.features } : {}),
      },
      updatedAt: now,
    });
    await ctx.db.patch(price._id, {
      externalProductId: args.externalProductId,
      externalPriceId: args.externalPriceId,
      unitAmount: args.unitAmount,
      currency: args.currency.toLowerCase(),
      updatedAt: now,
    });

    return {
      subscriptionProductId: existingProduct._id,
      subscriptionPriceId: price._id,
      externalProductId: args.externalProductId,
      externalPriceId: args.externalPriceId,
      lookupKey: args.lookupKey,
    };
  },
});
