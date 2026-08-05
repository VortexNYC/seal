import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
  type VortexOrganizationMemberFunctionReferences,
  VortexOrganizationMembersSurface,
  type VortexOrganizationRoleManagerFunctionReferences,
  VortexOrganizationRoleManagerSurface,
  type VortexOrganizationRoleTemplate,
  getVortexOrganizationRoleManagerErrorMessage,
  vortexOrganizationRoleTemplates,
} from "@vortexnyc/auth/react";
import { useQuery } from "convex/react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { TeamSettingsSkeleton } from "@/components/skeletons/team-settings-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

export const Route = createFileRoute("/_authenticated/$slug/settings/team/")({
  component: TeamSettings,
  pendingComponent: TeamSettingsSkeleton,
});

const SEAL_ROLE_OPTIONS = vortexOrganizationRoleTemplates.filter(
  (role): role is VortexOrganizationRoleTemplate =>
    role === "owner" ||
    role === "admin" ||
    role === "member" ||
    role === "viewer"
);

const organizationMemberRefs = {
  inviteMember: api.organizations.vortex_auth.inviteMember,
  listMembers: api.organizations.vortex_auth.listMembers,
  reactivateMember: api.organizations.vortex_auth.reactivateMember,
  setMemberRole: api.organizations.vortex_auth.setMemberRole,
  suspendMember: api.organizations.vortex_auth.suspendMember,
} satisfies VortexOrganizationMemberFunctionReferences;

const organizationRoleRefs = {
  createRole: api.organizations.vortex_roles.createRole,
  listPermissions: api.organizations.vortex_roles.listPermissions,
  listRoles: api.organizations.vortex_roles.listRoles,
} satisfies VortexOrganizationRoleManagerFunctionReferences;

function getMemberErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function memberStatusBadgeVariant(
  status: string
): "default" | "destructive" | "secondary" {
  if (status === "active") {
    return "default";
  }
  if (status === "suspended" || status === "inactive") {
    return "destructive";
  }
  return "secondary";
}

function TeamSettings() {
  const { slug } = Route.useParams();
  const { isPro } = useSubscriptionLimits();

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const permissions = useQuery(
    api.organizations.queries.getUserPermissions,
    organization?._id ? { organizationId: organization._id } : "skip"
  );

  if (!organization) {
    return null;
  }

  const canInvite = permissions?.permissions.canInviteMembers ?? false;
  const canManageRoles = permissions?.permissions.canUpdateRoles ?? false;
  const vortexOrgId = organization.vortexAuthOrganizationId;

  return (
    <PageWrapper title="Team">
      <div className="space-y-8">
        {!isPro && (
          <p className="text-muted-foreground text-sm">
            Inviting teammates requires Pro. You can still view members on Free.
          </p>
        )}
        <VortexOrganizationMembersSurface
          canManageMembers={canInvite && isPro}
          canManageRoles={canManageRoles && isPro}
          getErrorMessage={getMemberErrorMessage}
          organizationId={vortexOrgId ?? undefined}
          refs={organizationMemberRefs}
          renderActionError={(message) => {
            toast.error(message);
            return null;
          }}
          renderInvitationLink={({ title, value }) => (
            <div className="bg-muted/40 space-y-1 rounded-md border p-3 text-sm">
              <p className="font-medium">{title}</p>
              <code className="text-xs break-all">{value}</code>
            </div>
          )}
          renderStatus={(status) => (
            <Badge variant={memberStatusBadgeVariant(status)}>{status}</Badge>
          )}
          roleOptions={SEAL_ROLE_OPTIONS.filter((role) => role !== "owner")}
        />

        <Card>
          <CardHeader>
            <CardTitle>Roles and permissions</CardTitle>
            <CardDescription>
              System templates plus custom roles stored in Vortex Auth.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VortexOrganizationRoleManagerSurface
              canCreateRoles={canManageRoles}
              copy={{
                createTitle: "Custom role",
                roleListTitle: "Current roles",
              }}
              getErrorMessage={getVortexOrganizationRoleManagerErrorMessage}
              refs={organizationRoleRefs}
              renderActionError={(message) => (
                <p className="text-destructive text-sm" role="alert">
                  {message}
                </p>
              )}
            />
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
