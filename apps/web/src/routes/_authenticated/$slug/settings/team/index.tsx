import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Mail, Shield, User, Users, Eye } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { TeamSettingsSkeleton } from "@/components/skeletons/team-settings-skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import {
  getOrganization,
  getOrganizationMembers,
  getOrganizationTeam,
  type ApiTeamMember,
} from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/$slug/settings/team/")({
  component: TeamSettings,
  pendingComponent: TeamSettingsSkeleton,
});

const ROLE_OPTIONS = ["owner", "admin", "member", "viewer"] as const;

const ROLE_ICONS: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
};

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

function MemberRow({ member }: { member: ApiTeamMember }) {
  const Icon = ROLE_ICONS[member.role] ?? User;
  const initials =
    member.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 rounded-lg">
          <AvatarImage
            src={member.avatarUrl ?? undefined}
            alt={member.name ?? ""}
          />
          <AvatarFallback className="rounded-lg text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{member.name ?? member.email}</p>
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Mail className="h-3 w-3" />
            {member.email}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <Icon className="h-3 w-3" />
          <span className="capitalize">{member.role}</span>
        </div>
        <Badge variant={memberStatusBadgeVariant(member.status)}>
          {member.status}
        </Badge>
      </div>
    </div>
  );
}

function TeamSettings() {
  const { slug } = Route.useParams();
  const { isPro } = useSubscriptionLimits();

  const { data: organization } = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => getOrganization(slug),
  });

  const { data: team } = useQuery({
    queryKey: ["organization", slug, "team"],
    queryFn: () => getOrganizationTeam(slug),
    enabled: !!organization,
  });

  const { data: members } = useQuery({
    queryKey: ["organization", slug, "members"],
    queryFn: () => getOrganizationMembers(slug),
    enabled: !!organization,
  });

  if (!organization) {
    return null;
  }

  const canManage =
    organization.userRole === "owner" || organization.userRole === "admin";

  return (
    <PageWrapper title="Team">
      <div className="space-y-8">
        {!isPro && (
          <p className="text-muted-foreground text-sm">
            Inviting teammates requires Pro. You can still view members on Free.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Members
            </CardTitle>
            <CardDescription>
              {team
                ? `${team.total} total · ${team.active} active · ${team.pending} pending`
                : "Loading team summary"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canManage && isPro && (
              <p className="text-muted-foreground text-sm">
                Member management is available through Vortex Auth.
              </p>
            )}
            {members?.length ? (
              members.map((member) => (
                <MemberRow key={member.userId} member={member} />
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No members found.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles and permissions</CardTitle>
            <CardDescription>
              System roles managed in Vortex Auth.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {ROLE_OPTIONS.map((role) => {
                const Icon = ROLE_ICONS[role];
                const count = team?.byRole[role] ?? 0;
                return (
                  <div
                    key={role}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="text-muted-foreground h-4 w-4" />
                      <span className="font-medium capitalize">{role}</span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
