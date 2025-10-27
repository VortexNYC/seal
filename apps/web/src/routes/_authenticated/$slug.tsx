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
import { SidebarProvider } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated/$slug")({
	component: WorkspaceLayout,
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

	if (!organization || !orgId) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="text-center">
					<h2 className="text-2xl font-semibold">Loading workspace...</h2>
				</div>
			</div>
		);
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
