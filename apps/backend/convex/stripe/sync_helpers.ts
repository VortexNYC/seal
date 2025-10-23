/**
 * Stripe Sync Helper Functions
 *
 * Helper functions to reduce complexity in stripeSync.ts
 */

import type Stripe from "stripe";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

interface ProductMetadata {
	tier: string;
	includedCredits: number;
	features?: string[];
	purchase_type?: string;
}

interface SyncProductResult {
	action: "created" | "updated";
	name: string;
}

function hasRelevantMetadata(metadata: Stripe.Metadata | undefined): boolean {
	return Boolean(
		metadata?.tier || metadata?.includedCredits || metadata?.purchase_type,
	);
}

function parseProductMetadata(
	product: Stripe.Product,
): ProductMetadata | undefined {
	if (!hasRelevantMetadata(product.metadata)) {
		return undefined;
	}

	const tier = product.metadata?.tier || "unknown";
	const includedCredits = product.metadata?.includedCredits
		? parseInt(product.metadata.includedCredits)
		: 0;

	const features = product.metadata?.features
		? product.metadata.features.split(",").map((f) => f.trim())
		: undefined;

	const purchase_type = product.metadata?.purchase_type || undefined;

	return {
		tier,
		includedCredits,
		features,
		purchase_type,
	};
}

export async function syncProduct(
	ctx: ActionCtx,
	product: Stripe.Product,
): Promise<SyncProductResult> {
	const metadata = parseProductMetadata(product);

	const result = await ctx.runMutation(internal.stripe.sync.upsertProduct, {
		externalProductId: product.id,
		name: product.name,
		description: product.description || undefined,
		status: product.active ? "active" : "archived",
		metadata,
	});

	return result as SyncProductResult;
}

async function buildPriceParams(
	ctx: ActionCtx,
	price: Stripe.Price,
	productId: string,
) {
	// Lookup the subscription product ID from Convex
	const product = await ctx.runQuery(internal.stripe.sync.getProductByExternalId, {
		externalProductId: productId,
	});

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
		unitAmount: price.unit_amount || undefined,
		usageType: price.recurring?.usage_type || undefined,
		aggregateUsage:
			((price.recurring as Record<string, unknown> | null)?.aggregate_usage as
				| string
				| undefined) || undefined,
		meterId:
			((price.recurring as Record<string, unknown> | null)?.meter as
				| string
				| undefined) || undefined,
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
		startingAfter = page.data[page.data.length - 1].id;
	}

	console.warn(`  Synced ${total} prices for ${productName}`);
}
