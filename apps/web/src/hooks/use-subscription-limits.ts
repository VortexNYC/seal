import { api } from "@seal/backend/convex/_generated/api";
import { useQuery } from "convex/react";

/**
 * Hook for checking subscription plan limits in the UI.
 *
 * Wraps `getSubscriptionDetails` and provides convenient helpers
 * for conditionally rendering Pro-only features.
 */
export function useSubscriptionLimits() {
	const subscription = useQuery(api.stripe.queries.getSubscriptionDetails);

	const isLoading = subscription === undefined;

	const tier = subscription?.tier ?? "free";

	const isPro =
		(subscription?.status === "active" ||
			subscription?.status === "trialing") &&
		tier === "pro";

	return {
		isPro,
		isLoading,
		tier,
		subscription,
	};
}
