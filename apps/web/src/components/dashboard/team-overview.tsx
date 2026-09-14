/**
 * Dashboard Team Overview
 *
 * Shows organization name and member counts with a warmer visual treatment:
 * role-based mini badges and a more editorial card design.
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { UsersIcon } from "lucide-react";

import { betterAuthClient } from "@/lib/better-auth";
import { cn } from "@/lib/utils";

interface TeamOverviewProps {
  slug: string;
  organizationName: string;
}

interface RoleCounts {
  owner: number;
  admin: number;
  member: number;
  viewer: number;
}

interface TeamSummary {
  total: number;
  active: number;
  pending: number;
  byRole: RoleCounts;
}

function isKnownRole(role: string): role is keyof RoleCounts {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "member" ||
    role === "viewer"
  );
}

export function TeamOverview({
  slug,
  organizationName,
}: TeamOverviewProps): React.ReactElement {
  const { data: memberCount } = useSuspenseQuery({
    queryKey: ["api", "organization", slug, "team"],
    queryFn: async (): Promise<TeamSummary> => {
      const client = betterAuthClient;
      if (client === null) {
        throw new Error("Auth client is not available.");
      }
      if (client.organization?.getFullOrganization === undefined) {
        throw new Error("Organization API is not available.");
      }

      const response = await client.organization.getFullOrganization({
        query: { organizationSlug: slug },
      });
      if (response.error !== null) {
        throw new Error(
          response.error.message ?? "Could not load organization team."
        );
      }

      const fullOrg = response.data;
      if (fullOrg == null) {
        return {
          total: 0,
          active: 0,
          pending: 0,
          byRole: { owner: 0, admin: 0, member: 0, viewer: 0 },
        };
      }

      const byRole: RoleCounts = {
        owner: 0,
        admin: 0,
        member: 0,
        viewer: 0,
      };

      for (const member of fullOrg.members) {
        const role = member.role;
        if (typeof role === "string" && isKnownRole(role)) {
          byRole[role]++;
        }
      }

      const active = fullOrg.members.length;
      const pending = fullOrg.invitations.length;

      return {
        total: active + pending,
        active,
        pending,
        byRole,
      };
    },
  });

  const activeCount = memberCount.active;
  const totalCount = memberCount.total;
  const pendingCount = totalCount - activeCount;

  return (
    <LayerCard
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

      <LayerCard.Secondary>
        <div className="flex flex-row items-center justify-between space-y-0">
          <div>
            <h3 className="text-base font-semibold">Team Overview</h3>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {organizationName}
            </p>
          </div>
          <div className="bg-secondary flex h-10 w-10 items-center justify-center rounded-lg">
            <UsersIcon className="text-muted-foreground h-5 w-5" />
          </div>
        </div>
      </LayerCard.Secondary>
      <LayerCard.Primary>
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
      </LayerCard.Primary>
    </LayerCard>
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
