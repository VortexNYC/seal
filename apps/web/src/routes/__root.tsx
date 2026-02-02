import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { ConvexReactClient } from "convex/react";
import { ErrorBoundary } from "@/components/error-boundary";
import { NotFoundPage } from "@/components/not-found-page";
import { RouteErrorComponent } from "@/components/route-error-component";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
	convexClient: ConvexReactClient;
	convexQueryClient: ConvexQueryClient;
}>()({
	head: () => ({
		meta: [
			{
				title: "Seal",
			},
		],
	}),

	component: RootComponent,
	notFoundComponent: NotFoundPage,
	errorComponent: RouteErrorComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<ErrorBoundary>
				<Outlet />
			</ErrorBoundary>
		</RootDocument>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<>
			<HeadContent />
			<div className="h-svh">{children}</div>
			<Toaster richColors />
			<TanStackRouterDevtools position="bottom-right" />
		</>
	);
}
