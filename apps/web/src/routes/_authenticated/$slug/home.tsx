/**
 * Workspace Home/Dashboard Page
 *
 * Main dashboard for the workspace
 * Route: /{slug}/home
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { CheckCircle2, Clock, FileText, Users } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/home")({
	component: WorkspaceHome,
	pendingComponent: DashboardSkeleton,
});

function WorkspaceHome() {
	const { slug } = Route.useParams();

	const organization = useQuery(api.organizations.queries.getOrganization, {
		slug,
	});

	const orgId = organization?._id as Id<"organizations"> | undefined;

	const memberCount = useQuery(
		api.organizations.queries.getOrganizationMemberCount,
		orgId ? { organizationId: orgId } : "skip",
	);

	// Loading state handled by pendingComponent
	if (!organization || !orgId) {
		return null;
	}

	return (
		<PageWrapper title="Dashboard">
			<div className="space-y-6">
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Documents
							</CardTitle>
							<FileText className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">0</div>
							<p className="text-xs text-muted-foreground">No documents yet</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Team Members
							</CardTitle>
							<Users className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{memberCount?.active ?? 0}
							</div>
							<p className="text-xs text-muted-foreground">
								{memberCount?.total ?? 0} total
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Pending Signatures
							</CardTitle>
							<Clock className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">0</div>
							<p className="text-xs text-muted-foreground">
								Awaiting signatures
							</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Completed</CardTitle>
							<CheckCircle2 className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">0</div>
							<p className="text-xs text-muted-foreground">This month</p>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Recent Activity</CardTitle>
						<CardDescription>
							Your team's recent document activity
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
							No recent activity
						</div>
					</CardContent>
				</Card>
			</div>
		</PageWrapper>
	);
}
