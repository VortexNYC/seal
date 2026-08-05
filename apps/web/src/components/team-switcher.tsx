"use client";

import {
  VortexOrganizationSwitcher,
  type VortexOrgSwitcherOrganization,
} from "@vortexnyc/auth/react";
import { Building2 } from "lucide-react";
import * as React from "react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function TeamSwitcher({
  teams,
  activeSlug,
  onTeamSelect,
  onCreateOrganization,
}: {
  teams: {
    name: string;
    logo: React.ElementType;
    plan: string;
    slug: string;
    id?: string;
  }[];
  activeSlug?: string;
  onTeamSelect?: (slug: string) => void;
  onCreateOrganization?: () => void;
}) {
  const organizations = React.useMemo<VortexOrgSwitcherOrganization[]>(
    () =>
      teams.map((team) => ({
        _id: team.id ?? team.slug,
        name: team.name,
        slug: team.slug,
        imageUrl: undefined,
      })),
    [teams]
  );

  const current = React.useMemo(() => {
    if (activeSlug) {
      return organizations.find((org) => org.slug === activeSlug) ?? null;
    }
    return organizations[0] ?? null;
  }, [activeSlug, organizations]);

  if (organizations.length === 0) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <VortexOrganizationSwitcher
          currentOrganization={current}
          currentOrganizationId={current?._id}
          onCreateOrganization={onCreateOrganization}
          onSelectOrganization={(organizationId) => {
            const selected = organizations.find(
              (org) => org._id === organizationId
            );
            if (selected?.slug) {
              onTeamSelect?.(selected.slug);
            }
          }}
          organizations={organizations}
          renderCustomTrigger={({ organization, onClick }) => (
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              onClick={onClick}
              size="lg"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {organization?.name ?? "Workspace"}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {organization?.slug ?? ""}
                </span>
              </div>
            </SidebarMenuButton>
          )}
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
