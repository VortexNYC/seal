import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { TeamSettingsSkeleton } from "@/components/skeletons/team-settings-skeleton";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { MembersList } from "@/components/team/members-list";
import { PendingInvitationsList } from "@/components/team/pending-invitations-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

export const Route = createFileRoute("/_authenticated/$slug/settings/team/")({
  component: TeamSettings,
  pendingComponent: TeamSettingsSkeleton,
});

function TeamSettings() {
  const { slug } = Route.useParams();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { isPro } = useSubscriptionLimits();

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
    orgId && permissions?.permissions.canInviteMembers ? { organizationId: orgId } : "skip",
  );

  // Loading state handled by pendingComponent
  if (!organization || !orgId) {
    return null;
  }

  const canInvite = permissions?.permissions.canInviteMembers ?? false;
  const canInviteWithPlan = canInvite && isPro;
  const canManageRoles = permissions?.permissions.canUpdateRoles ?? false;
  const canRemove = permissions?.permissions.canRemoveMembers ?? false;

  const invitationCount = invitations?.length ?? 0;

  return (
    <PageWrapper
      title="Team"
      action={
        canInvite
          ? {
              label: isPro ? "Invite Member" : "Invite Member (Pro)",
              onClick: () => {
                if (isPro) {
                  setIsInviteDialogOpen(true);
                }
              },
              icon: UserPlus,
              disabled: !isPro,
            }
          : undefined
      }
    >
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="bg-card/60">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invitations">
            Invitations
            {canInvite && invitationCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {invitationCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {members?.length ?? 0} {members?.length === 1 ? "member" : "members"} in this
                workspace
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
        </TabsContent>

        <TabsContent value="invitations" className="mt-6">
          {canInvite ? (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
                <CardDescription>
                  {invitationCount} pending {invitationCount === 1 ? "invitation" : "invitations"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PendingInvitationsList
                  invitations={
                    invitations?.map((inv) => ({
                      ...inv,
                      role: inv.role === "system" || inv.role === "owner" ? "admin" : inv.role,
                    })) ?? []
                  }
                  organizationId={orgId}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                You do not have permission to view invitations
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Invite Member Dialog */}
      {canInviteWithPlan && (
        <InviteMemberDialog
          organizationId={orgId}
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
        />
      )}
    </PageWrapper>
  );
}
