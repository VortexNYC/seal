/**
 * Team Management Page
 *
 * Manage organization members, invitations, and roles
 * Route: /{slug}/settings/team
 */

import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@seal/backend/convex/_generated/api';
import type { Id } from '@seal/backend/convex/_generated/dataModel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { MembersList } from '@/components/team/members-list';
import { PendingInvitationsList } from '@/components/team/pending-invitations-list';
import { InviteMemberDialog } from '@/components/team/invite-member-dialog';

export const Route = createFileRoute('/_authenticated/$slug/settings/team')({
  component: TeamSettings,
});

function TeamSettings() {
  const { slug } = Route.useParams();

  // Fetch organization details
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  if (!organization) {
    return <div>Loading...</div>;
  }

  const orgId = organization._id as Id<"organizations">;

  // Fetch permissions
  const permissions = useQuery(api.organizations.queries.getUserPermissions, {
    organizationId: orgId,
  });

  // Fetch members
  const members = useQuery(api.organizations.queries.getOrganizationMembers, {
    organizationId: orgId,
  });

  // Fetch pending invitations (only if user has permission)
  const invitations = useQuery(
    api.organizations.queries.getPendingInvitations,
    permissions?.permissions.canInviteMembers
      ? { organizationId: orgId }
      : 'skip'
  );

  const canInvite = permissions?.permissions.canInviteMembers ?? false;
  const canManageRoles = permissions?.permissions.canUpdateRoles ?? false;
  const canRemove = permissions?.permissions.canRemoveMembers ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            Manage your team members and their permissions
          </p>
        </div>
        {canInvite && <InviteMemberDialog organizationId={orgId} />}
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members?.length ?? 0} {members?.length === 1 ? 'member' : 'members'} in this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersList
            members={members ?? []}
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
              {invitations.length} pending {invitations.length === 1 ? 'invitation' : 'invitations'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PendingInvitationsList
              invitations={invitations}
              organizationId={orgId}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
