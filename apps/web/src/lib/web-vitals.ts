/**
 * Core Web Vitals Tracking
 *
 * Tracks LCP, FID, CLS, FCP, TTFB and reports to PostHog analytics.
 * See: https://web.dev/vitals/
 */

import type { Metric } from "web-vitals";

type ReportHandler = (metric: Metric) => void;

/**
 * Reports a web vital metric to PostHog
 */
function sendToPostHog(metric: Metric): void {
	// PostHog is loaded globally via the posthog-js library
	const posthog = (
		window as unknown as {
			posthog?: {
				capture: (event: string, properties: Record<string, unknown>) => void;
			};
		}
	).posthog;

	if (!posthog) {
		// PostHog not loaded yet, skip reporting
		return;
	}

	// Prepare the metric data
	const metricData = {
		metric_name: metric.name,
		metric_value: metric.value,
		metric_rating: metric.rating, // 'good', 'needs-improvement', or 'poor'
		metric_delta: metric.delta,
		metric_id: metric.id,
		metric_navigationType: metric.navigationType,
		// Include entries for debugging if needed
		metric_entries_count: metric.entries.length,
	};

	// Send to PostHog
	posthog.capture("web_vitals", metricData);
}

/**
 * Initialize Core Web Vitals tracking
 * Call this once when the app loads
 */
export async function initWebVitals(onReport?: ReportHandler): Promise<void> {
	// Dynamically import web-vitals to avoid blocking initial load
	const { onCLS, onFCP, onINP, onLCP, onTTFB } = await import("web-vitals");

	const reportHandler: ReportHandler = (metric) => {
		// Always send to PostHog
		sendToPostHog(metric);

		// Call custom handler if provided
		onReport?.(metric);

		// Log in development for debugging
		if (import.meta.env.DEV) {
			console.log(`[Web Vitals] ${metric.name}:`, {
				value: metric.value,
				rating: metric.rating,
				delta: metric.delta,
			});
		}
	};

	// Track all Core Web Vitals
	onCLS(reportHandler);
	onFCP(reportHandler);
	onINP(reportHandler); // Interaction to Next Paint (replaced FID)
	onLCP(reportHandler);
	onTTFB(reportHandler);
}
