import {
  AuthProvider,
  InviteMemberForm,
  OrganizationMembers,
} from "@vortexnyc/better-auth-ui";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";
import { TeamSettingsSkeleton } from "@/components/skeletons/team-settings-skeleton";
import { useOrganization } from "@/hooks/use-organization";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";

export const Route = createFileRoute("/_authenticated/$slug/settings/team/")({
  component: TeamSettings,
  pendingComponent: TeamSettingsSkeleton,
});

function TeamSettings() {
  const { slug } = Route.useParams();
  const client = getBetterAuthUiClient();
  const { isPro } = useSubscriptionLimits();

  const { data: organization } = useOrganization(slug);

  const canManage =
    organization?.userRole === "owner" ||
    organization?.userRole === "admin";

  if (client === null) {
    return (
      <PageWrapper title="Team">
        <TeamSettingsSkeleton />
      </PageWrapper>
    );
  }

  return (
    <AuthProvider client={client}>
      <PageWrapper title="Team">
        <div className="space-y-8">
          {!isPro && (
            <p className="text-muted-foreground text-sm">
              Inviting teammates requires Pro. You can still view members on
              Free.
            </p>
          )}

          {isPro && canManage && (
            <InviteMemberForm
              title="Invite member"
              description="Add a teammate to this workspace."
            />
          )}

          <OrganizationMembers
            canManageMembers={canManage}
            onMemberRemoved={() => {
              // better-auth-ui reloads internally; no external refetch needed
            }}
            onInvitationCancelled={() => {
              // better-auth-ui reloads internally
            }}
          />
        </div>
      </PageWrapper>
    </AuthProvider>
  );
}
