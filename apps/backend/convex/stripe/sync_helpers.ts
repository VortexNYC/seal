/**
 * Stripe Sync Helper Functions
 *
 * Helper functions to reduce complexity in stripeSync.ts
 */

import type Stripe from "stripe";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

interface ProductMetadata {
	tier?: string;
	useType?: string;
	features?: string;
	includedCredits?: number;
}

interface SyncProductResult {
	action: "created" | "updated" | "failed";
	name: string;
}

/**
 * Get a metadata value, checking multiple possible keys (camelCase and snake_case)
 */
function getMetadataValue(
	metadata: Stripe.Metadata | undefined,
	...keys: string[]
): string | undefined {
	if (!metadata) return undefined;

	for (const key of keys) {
		const value = metadata[key];
		if (value !== undefined && value !== null) {
			return value;
		}
	}

	return undefined;
}

/**
 * Parse an integer from metadata, returning undefined if not present or invalid
 */
function parseIntMetadataValue(
	metadata: Stripe.Metadata | undefined,
	...keys: string[]
): number | undefined {
	const raw = getMetadataValue(metadata, ...keys);
	if (raw === undefined) return undefined;
	const parsed = Number.parseInt(raw, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function hasRelevantMetadata(metadata: Stripe.Metadata | undefined): boolean {
	return Boolean(
		getMetadataValue(metadata, "tier") ||
			getMetadataValue(metadata, "useType", "use_type") ||
			getMetadataValue(metadata, "features") ||
			getMetadataValue(metadata, "includedCredits", "included_credits"),
	);
}

function parseProductMetadata(
	product: Stripe.Product,
): ProductMetadata | undefined {
	if (!hasRelevantMetadata(product.metadata)) {
		return undefined;
	}

	const metadata = product.metadata;
	const tier = getMetadataValue(metadata, "tier");
	const useType = getMetadataValue(metadata, "useType", "use_type");
	const features = getMetadataValue(metadata, "features");
	const includedCredits = parseIntMetadataValue(
		metadata,
		"includedCredits",
		"included_credits",
	);

	return {
		tier,
		useType,
		features,
		includedCredits,
	};
}

export async function syncProduct(
	ctx: ActionCtx,
	product: Stripe.Product,
): Promise<SyncProductResult> {
	const metadata = parseProductMetadata(product);

	try {
		const result = await ctx.runMutation(internal.stripe.sync.upsertProduct, {
			externalProductId: product.id,
			name: product.name,
			description: product.description || undefined,
			status: product.active ? "active" : "archived",
			metadata,
		});

		return result as SyncProductResult;
	} catch (error) {
		// Log error but continue syncing other products
		console.error("Failed to sync Stripe product", {
			productId: product.id,
			productName: product.name,
			metadata: product.metadata,
			error: error instanceof Error ? error.message : String(error),
		});
		return { action: "failed", name: product.name };
	}
}

async function buildPriceParams(
	ctx: ActionCtx,
	price: Stripe.Price,
	productId: string,
) {
	// Lookup the subscription product ID from Convex
	const product = await ctx.runQuery(
		internal.stripe.sync.getProductByExternalId,
		{
			externalProductId: productId,
		},
	);

	if (!product) {
		throw new Error(`Product ${productId} not found in database`);
	}

	return {
		externalPriceId: price.id,
		externalProductId: productId,
		subscriptionProductId: product._id,
		type: price.type as "recurring" | "one_time",
		billingScheme: price.billing_scheme as "per_unit" | "tiered",
		currency: price.currency,
		recurring: price.recurring
			? {
					interval: price.recurring.interval,
					intervalCount: price.recurring.interval_count,
				}
			: undefined,
		unitAmount: price.unit_amount ?? undefined,
		usageType: price.recurring?.usage_type || undefined,
		status: (price.active ? "active" : "archived") as
			| "active"
			| "archived"
			| "deleted",
		lookupKey: price.lookup_key || undefined,
	};
}

async function syncSinglePrice(
	ctx: ActionCtx,
	price: Stripe.Price,
	productId: string,
): Promise<void> {
	const priceParams = await buildPriceParams(ctx, price, productId);
	const priceResult = await ctx.runMutation(
		internal.stripe.sync.upsertPrice,
		priceParams,
	);

	const amount = priceResult.amount
		? `$${priceResult.amount / 100}`
		: "metered";
	const action = priceResult.action === "created" ? "Created" : "Updated";
	console.warn(
		`  ${action} price: ${price.lookup_key || price.id} (${amount})`,
	);
}

export async function syncPrices(
	ctx: ActionCtx,
	stripe: Stripe,
	productId: string,
	productName: string,
): Promise<void> {
	let startingAfter: string | undefined;
	let total = 0;
	// Paginate through all prices (active and archived)
	// Using manual pagination to control logging and backfill behavior
	while (true) {
		const params: Stripe.PriceListParams = {
			product: productId,
			limit: 100,
		};
		if (startingAfter) params.starting_after = startingAfter;

		const page = await stripe.prices.list(params);
		if (page.data.length === 0) break;

		for (const price of page.data) {
			await syncSinglePrice(ctx, price, productId);
		}

		total += page.data.length;
		if (!page.has_more) break;
		const lastItem = page.data[page.data.length - 1];
		if (!lastItem) break;
		startingAfter = lastItem.id;
	}

	console.warn(`  Synced ${total} prices for ${productName}`);
}
