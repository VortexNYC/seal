import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import ReactDOM from "react-dom/client";
import { DefaultCatchBoundary } from "./components/default-catch-boundary";
import Loader from "./components/loader";
import { NotFound } from "./components/not-found";
import { initWebVitals } from "./lib/web-vitals";
import { routeTree } from "./routeTree.gen";

import "./styles.css";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
const CLERK_URL = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CONVEX_URL) {
	throw new Error("missing VITE_CONVEX_URL envar");
}
if (!CLERK_URL) {
	throw new Error("missing VITE_CLERK_PUBLISHABLE_KEY envar");
}

Sentry.init({
	dsn: SENTRY_DSN,
	// Setting this option to true will send default PII data to Sentry.
	// For example, automatic IP address collection on events
	sendDefaultPii: true,
});

const convex = new ConvexReactClient(CONVEX_URL);
const convexQueryClient = new ConvexQueryClient(convex);

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			queryKeyHashFn: convexQueryClient.hashFn(),
			queryFn: convexQueryClient.queryFn(),
		},
	},
});
convexQueryClient.connect(queryClient);

// Create a new router instance
const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	defaultPendingComponent: () => <Loader />,
	defaultErrorComponent: DefaultCatchBoundary,
	defaultNotFoundComponent: () => <NotFound />,
	scrollRestoration: true,
	defaultStructuralSharing: true,
	defaultPreloadStaleTime: 0,
	context: { queryClient, convexClient: convex, convexQueryClient },
	Wrap: function WrapComponent({ children }: { children: React.ReactNode }) {
		return (
			<ClerkProvider
				publishableKey={CLERK_URL}
				signInUrl="/sign-in"
				signUpUrl="/sign-up"
				afterSignInUrl="/app"
				afterSignUpUrl="/app"
				signInFallbackRedirectUrl="/app"
				signUpFallbackRedirectUrl="/app"
			>
				<ConvexProviderWithClerk client={convex} useAuth={useAuth}>
					<QueryClientProvider client={queryClient}>
						{children}
					</QueryClientProvider>
				</ConvexProviderWithClerk>
			</ClerkProvider>
		);
	},
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}

const rootElement = document.getElementById("app");

if (!rootElement) {
	throw new Error("Root element not found");
}

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string;

if (POSTHOG_KEY) {
	posthog.init(POSTHOG_KEY, {
		// Use reverse proxy to bypass ad blockers (configured in vite.config.ts and vercel.json)
		api_host: "/ingest",
		ui_host: "https://us.i.posthog.com",
		capture_pageview: true,
		capture_pageleave: true,
		debug: import.meta.env.MODE === "development",
	});
}

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(
		<PostHogProvider client={posthog}>
			<RouterProvider router={router} />
		</PostHogProvider>,
	);

	// Initialize Core Web Vitals tracking after render
	// This reports LCP, INP, CLS, FCP, TTFB to PostHog
	initWebVitals().catch((error) => {
		console.warn("Failed to initialize web vitals:", error);
	});
}
