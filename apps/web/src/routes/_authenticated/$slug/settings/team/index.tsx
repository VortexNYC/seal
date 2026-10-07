import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";
import {
  AuthProvider,
  InviteMemberForm,
  isOrganizationAdminRole,
  OrganizationMembers,
} from "@vortex-api/better-auth-ui";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
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

  const canManage = isOrganizationAdminRole(organization?.userRole);

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
        <SettingsBody>
          <div className="flex flex-col gap-5">
            {!isPro && (
              <Text as="p" variant="secondary" size="sm">Inviting teammates requires Pro. You can still view members on
                Free.</Text>
            )}

            {isPro && canManage && (
              <InviteMemberForm
                className="w-full max-w-none"
                title="Invite member"
                description="Add a teammate to this workspace."
              />
            )}

            <OrganizationMembers
              className="w-full max-w-none"
              canManageMembers={canManage}
              onMemberRemoved={() => {
                // better-auth-ui reloads internally; no external refetch needed
              }}
              onInvitationCancelled={() => {
                // better-auth-ui reloads internally
              }}
            />
          </div>
        </SettingsBody>
      </PageWrapper>
    </AuthProvider>
  );
}
