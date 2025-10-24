import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import ReactDOM from "react-dom/client";
import { DefaultCatchBoundary } from "./components/default-catch-boundary";
import Loader from "./components/loader";
import { NotFound } from "./components/not-found";
import { routeTree } from "./routeTree.gen";

import "./styles.css";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
const CLERK_URL = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CONVEX_URL) {
	throw new Error("missing VITE_CONVEX_URL envar");
}
if (!CLERK_URL) {
	throw new Error("missing VITE_CLERK_PUBLISHABLE_KEY envar");
}

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

if (!rootElement.innerHTML) {
	const root = ReactDOM.createRoot(rootElement);
	root.render(<RouterProvider router={router} />);
}
