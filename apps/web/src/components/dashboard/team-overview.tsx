/**
 * Dashboard Team Overview
 *
 * Shows organization name and member counts with a warmer visual treatment:
 * role-based mini badges and a more editorial card design.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { UsersIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganizationTeam } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface TeamOverviewProps {
  slug: string;
  organizationName: string;
}

export function TeamOverview({
  slug,
  organizationName,
}: TeamOverviewProps): React.ReactElement {
  const { data: memberCount } = useSuspenseQuery({
    queryKey: ["api", "organization", slug, "team"],
    queryFn: () => getOrganizationTeam(slug),
  });

  const activeCount = memberCount.active;
  const totalCount = memberCount.total;
  const pendingCount = totalCount - activeCount;

  return (
    <Card
      className="group relative overflow-hidden"
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: "550ms",
      }}
    >
      {/* Decorative background */}
      <UsersIcon
        className="pointer-events-none absolute -right-4 -bottom-4 h-28 w-28 opacity-[0.03] transition-opacity duration-[var(--duration-default)] group-hover:opacity-[0.06]"
        strokeWidth={1}
      />

      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Team Overview</CardTitle>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {organizationName}
          </p>
        </div>
        <div className="bg-secondary flex h-10 w-10 items-center justify-center rounded-lg">
          <UsersIcon className="text-muted-foreground h-5 w-5" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-serif text-3xl font-normal tracking-tight tabular-nums">
          {activeCount}{" "}
          <span className="text-muted-foreground font-sans text-lg">
            active
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {memberCount.byRole && (
            <>
              {memberCount.byRole.owner > 0 && (
                <RolePill
                  label="Owners"
                  count={memberCount.byRole.owner}
                  colorClass="bg-role-owner-surface text-role-owner"
                />
              )}
              {memberCount.byRole.admin > 0 && (
                <RolePill
                  label="Admins"
                  count={memberCount.byRole.admin}
                  colorClass="bg-role-admin-surface text-role-admin"
                />
              )}
              {memberCount.byRole.member > 0 && (
                <RolePill
                  label="Members"
                  count={memberCount.byRole.member}
                  colorClass="bg-role-member-surface text-role-member"
                />
              )}
              {memberCount.byRole.viewer > 0 && (
                <RolePill
                  label="Viewers"
                  count={memberCount.byRole.viewer}
                  colorClass="bg-role-viewer-surface text-role-viewer"
                />
              )}
            </>
          )}
          {pendingCount > 0 && (
            <RolePill
              label="Pending"
              count={pendingCount}
              colorClass="bg-warning-surface text-warning"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RolePill({
  label,
  count,
  colorClass,
}: {
  label: string;
  count: number;
  colorClass: string;
}): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        colorClass
      )}
    >
      {count} {label}
    </span>
  );
}
