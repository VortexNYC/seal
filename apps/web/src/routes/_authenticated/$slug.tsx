/**
 * Workspace Layout Route
 *
 * Main layout for organization workspaces with sidebar navigation
 * Route: /{slug}/*
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AppSidebar } from "@/components/app-sidebar";
import { WorkspaceLayoutSkeleton } from "@/components/skeletons/workspace-layout-skeleton";
import { SidebarProvider } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/$slug")({
	component: WorkspaceLayout,
	pendingComponent: WorkspaceLayoutSkeleton,
});

function WorkspaceLayout() {
	const { slug } = Route.useParams();

	const organization = useQuery(api.organizations.queries.getOrganization, {
		slug,
	});

	const orgId = organization?._id as Id<"organizations"> | undefined;

	const permissions = useQuery(
		api.organizations.queries.getUserPermissions,
		orgId ? { organizationId: orgId } : "skip",
	);

	// Loading state handled by pendingComponent
	if (!organization || !orgId) {
		return null;
	}

	return (
		<SidebarProvider>
			<div className="flex min-h-screen w-full">
				<AppSidebar
					slug={slug}
					organization={{
						_id: orgId,
						name: organization.name,
						slug: organization.slug,
					}}
					permissions={permissions}
				/>
				<main className="flex-1">
					<Outlet />
				</main>
			</div>
		</SidebarProvider>
	);
}
