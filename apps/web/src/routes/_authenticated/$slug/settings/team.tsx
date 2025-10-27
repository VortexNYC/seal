import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { PageWrapper } from "@/components/page-wrapper";
import { MembersList } from "@/components/team/members-list";
import { PendingInvitationsList } from "@/components/team/pending-invitations-list";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/$slug/settings/team")({
	component: TeamSettings,
});

function TeamSettings() {
	const { slug } = Route.useParams();

	const organization = useQuery(api.organizations.queries.getOrganization, {
		slug,
	});

	const orgId = organization?._id as Id<"organizations"> | undefined;

	const permissions = useQuery(
		api.organizations.queries.getUserPermissions,
		orgId ? { organizationId: orgId } : "skip",
	);

	const members = useQuery(
		api.organizations.queries.getOrganizationMembers,
		orgId ? { organizationId: orgId } : "skip",
	);

	const invitations = useQuery(
		api.organizations.queries.getPendingInvitations,
		orgId && permissions?.permissions.canInviteMembers
			? { organizationId: orgId }
			: "skip",
	);

	if (!organization || !orgId) {
		return <div>Loading...</div>;
	}

	const canInvite = permissions?.permissions.canInviteMembers ?? false;
	const canManageRoles = permissions?.permissions.canUpdateRoles ?? false;
	const canRemove = permissions?.permissions.canRemoveMembers ?? false;

	return (
		<PageWrapper title="Team Members">
			<div className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Members</CardTitle>
						<CardDescription>
							{members?.length ?? 0}{" "}
							{members?.length === 1 ? "member" : "members"} in this workspace
						</CardDescription>
					</CardHeader>
					<CardContent>
						<MembersList
							members={
								members?.map((m) => ({
									...m,
									name: m.name ?? null,
									avatarUrl: m.avatarUrl ?? null,
								})) ?? []
							}
							organizationId={orgId}
							canManageRoles={canManageRoles}
							canRemove={canRemove}
						/>
					</CardContent>
				</Card>

				{canInvite && invitations && invitations.length > 0 && (
					<Card>
						<CardHeader>
							<CardTitle>Pending Invitations</CardTitle>
							<CardDescription>
								{invitations.length} pending{" "}
								{invitations.length === 1 ? "invitation" : "invitations"}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<PendingInvitationsList
								invitations={invitations.map((inv) => ({
									...inv,
									role:
										inv.role === "system" || inv.role === "owner"
											? "admin"
											: inv.role,
								}))}
								organizationId={orgId}
							/>
						</CardContent>
					</Card>
				)}
			</div>
		</PageWrapper>
	);
}
