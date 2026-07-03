"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { requestVortexBillingJson } from "./payable_actions";

type UnknownRecord = Readonly<Record<string, unknown>>;
type ProductStatus = "active" | "archived";
type PriceStatus = "active" | "archived";
type PriceType = "recurring" | "one_time";
type ProductMetadata = {
  readonly tier?: string;
  readonly useType?: string;
  readonly features?: string;
};

type VortexCatalogProduct = {
  readonly productId: string;
  readonly name: string;
  readonly description?: string;
  readonly status: ProductStatus;
  readonly metadata?: ProductMetadata;
};

type VortexCatalogPrice = {
  readonly priceId: string;
  readonly productId: string;
  readonly type: PriceType;
  readonly currency: string;
  readonly billingInterval?: string;
  readonly unitAmount: number;
  readonly status: PriceStatus;
  readonly lookupKey?: string;
};

type SyncCatalogFromVortexResult = {
  readonly success: true;
  readonly requestId?: string;
  readonly syncedProducts: number;
  readonly syncedPrices: number;
  readonly archivedProducts: number;
  readonly archivedPrices: number;
};

const API_BASE_URL_ENV = "VORTEX_BILLING_API_BASE_URL";
const API_KEY_ENV = "VORTEX_BILLING_API_KEY";

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new ConvexError(`${name} is required for Vortex catalog sync`);
  }
  return value;
}

function readObject(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConvexError(`${label} must be an object`);
  }
  return value as UnknownRecord;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ConvexError(`${label} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return readString(value, label);
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ConvexError(`${label} must be a finite number`);
  }
  return value;
}

function readArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ConvexError(`${label} must be an array`);
  }
  return value;
}

function hasArchivedAt(record: UnknownRecord): boolean {
  return record.archivedAt !== undefined && record.archivedAt !== null;
}

function readProductMetadata(value: unknown): ProductMetadata | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const metadata = readObject(value, "Vortex catalog product metadata");
  const tier = readOptionalString(metadata.tier, "Vortex catalog product metadata.tier");
  const useType = readOptionalString(metadata.useType, "Vortex catalog product metadata.useType");
  const rawFeatures = metadata.features;
  const features =
    typeof rawFeatures === "string"
      ? rawFeatures
      : Array.isArray(rawFeatures) &&
          rawFeatures.every((feature): feature is string => typeof feature === "string")
        ? rawFeatures.join(",")
        : undefined;

  if (tier === undefined && useType === undefined && features === undefined) {
    return undefined;
  }

  return {
    ...(tier !== undefined ? { tier } : {}),
    ...(useType !== undefined ? { useType } : {}),
    ...(features !== undefined ? { features } : {}),
  };
}

function readPriceType(value: unknown): PriceType {
  const priceType = readString(value, "Vortex catalog price.priceType");
  if (priceType !== "recurring" && priceType !== "one_time") {
    throw new ConvexError(`Unsupported Vortex catalog priceType: ${priceType}`);
  }
  return priceType;
}

function readProduct(value: unknown): VortexCatalogProduct {
  const product = readObject(value, "Vortex catalog product");
  return {
    productId: readString(product.productId, "Vortex catalog product.productId"),
    name: readString(product.name, "Vortex catalog product.name"),
    description: readOptionalString(product.description, "Vortex catalog product.description"),
    status: hasArchivedAt(product) ? "archived" : "active",
    metadata: readProductMetadata(product.metadata),
  };
}

function readPrice(value: unknown): VortexCatalogPrice {
  const price = readObject(value, "Vortex catalog price");
  return {
    priceId: readString(price.priceId, "Vortex catalog price.priceId"),
    productId: readString(price.productId, "Vortex catalog price.productId"),
    type: readPriceType(price.priceType),
    currency: readString(price.currency, "Vortex catalog price.currency").toLowerCase(),
    billingInterval: readOptionalString(
      price.billingInterval,
      "Vortex catalog price.billingInterval",
    ),
    unitAmount: readNumber(price.unitAmount, "Vortex catalog price.unitAmount"),
    status: hasArchivedAt(price) ? "archived" : "active",
    lookupKey: readOptionalString(price.lookupKey, "Vortex catalog price.lookupKey"),
  };
}

function readCatalogResponse(body: unknown): {
  readonly products: readonly VortexCatalogProduct[];
  readonly prices: readonly VortexCatalogPrice[];
  readonly requestId?: string;
} {
  const root = readObject(body, "Vortex catalog response");
  const data = readObject(root.data, "Vortex catalog response data");
  return {
    products: readArray(data.products, "Vortex catalog products").map(readProduct),
    prices: readArray(data.prices, "Vortex catalog prices").map(readPrice),
    requestId: readOptionalString(root.requestId, "Vortex catalog requestId"),
  };
}

function recurringForPrice(
  price: VortexCatalogPrice,
): { readonly interval: string; readonly intervalCount: number } | undefined {
  if (price.type === "one_time") {
    return undefined;
  }
  if (price.billingInterval === undefined) {
    throw new ConvexError(`Vortex recurring price missing billingInterval: ${price.priceId}`);
  }
  return {
    interval: price.billingInterval,
    intervalCount: 1,
  };
}

export const syncCatalogFromVortex = internalAction({
  args: {},
  returns: v.object({
    success: v.literal(true),
    requestId: v.optional(v.string()),
    syncedProducts: v.number(),
    syncedPrices: v.number(),
    archivedProducts: v.number(),
    archivedPrices: v.number(),
  }),
  handler: async (ctx): Promise<SyncCatalogFromVortexResult> => {
    const body = await requestVortexBillingJson(
      {
        apiBaseUrl: readRequiredEnv(API_BASE_URL_ENV),
        apiKey: readRequiredEnv(API_KEY_ENV),
        method: "GET",
        path: "/v1/catalog",
        failureLabel: "Vortex Billing catalog sync",
      },
      (input, init) => fetch(input, init),
    );
    const catalog = readCatalogResponse(body);
    const productIdsByVortexId = new Map<string, Id<"subscription_products">>();
    let archivedProducts = 0;
    let archivedPrices = 0;

    for (const product of catalog.products) {
      const result = await ctx.runMutation(
        internal.vortex_billing.catalog_mutations.upsertProductByVortexId,
        {
          vortexProductId: product.productId,
          name: product.name,
          description: product.description,
          status: product.status,
          metadata: product.metadata,
        },
      );
      productIdsByVortexId.set(product.productId, result.subscriptionProductId);
      if (product.status === "archived") {
        archivedProducts++;
      }
    }

    for (const price of catalog.prices) {
      const subscriptionProductId = productIdsByVortexId.get(price.productId);
      if (subscriptionProductId === undefined) {
        throw new ConvexError(
          `Vortex catalog price ${price.priceId} references missing product ${price.productId}`,
        );
      }

      await ctx.runMutation(internal.vortex_billing.catalog_mutations.upsertPriceByVortexId, {
        vortexPriceId: price.priceId,
        vortexProductId: price.productId,
        subscriptionProductId,
        type: price.type,
        billingScheme: "per_unit",
        currency: price.currency,
        recurring: recurringForPrice(price),
        unitAmount: price.unitAmount,
        usageType: price.type === "recurring" ? "licensed" : undefined,
        status: price.status,
        lookupKey: price.lookupKey,
      });
      if (price.status === "archived") {
        archivedPrices++;
      }
    }

    return {
      success: true,
      requestId: catalog.requestId,
      syncedProducts: catalog.products.length,
      syncedPrices: catalog.prices.length,
      archivedProducts,
      archivedPrices,
    };
  },
});
