"use client";

import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Buildings, CaretDown, Plus } from "@phosphor-icons/react";
import * as React from "react";

type Team = {
  id?: string;
  name: string;
  slug: string;
  logo: React.ElementType;
  plan: string;
};

export function TeamSwitcher({
  teams,
  activeSlug,
  onTeamSelect,
  onCreateOrganization,
}: {
  teams: Team[];
  activeSlug?: string;
  onTeamSelect?: (slug: string) => void;
  onCreateOrganization?: () => void;
}) {
  const active = React.useMemo(
    () => teams.find((team) => team.slug === activeSlug) ?? teams[0] ?? null,
    [teams, activeSlug]
  );

  const ActiveLogo = active?.logo ?? Buildings;

  if (teams.length === 0) {
    return null;
  }

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Sidebar.MenuButton size="base" className="group">
              <div className="bg-kumo-elevated text-kumo-primary flex aspect-square size-8 items-center justify-center rounded-lg">
                <ActiveLogo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {active?.name ?? "Workspace"}
                </span>
                <span className="text-kumo-secondary truncate text-xs">
                  {active?.plan ?? ""}
                </span>
              </div>
              <CaretDown className="ml-auto size-4" />
            </Sidebar.MenuButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenu.Label>Workspaces</DropdownMenu.Label>
            {teams.map((team) => {
              const Logo = team.logo;
              const isActive = team.slug === active?.slug;
              return (
                <DropdownMenu.Item
                  key={team.slug}
                  icon={<Logo className="size-3.5" />}
                  selected={isActive}
                  onClick={() => onTeamSelect?.(team.slug)}
                >
                  <div className="grid flex-1 leading-tight">
                    <span className="truncate text-sm font-medium">
                      {team.name}
                    </span>
                    <span className="text-kumo-secondary text-xs">
                      {team.plan}
                    </span>
                  </div>
                </DropdownMenu.Item>
              );
            })}
            {onCreateOrganization && (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Item icon={Plus} onClick={onCreateOrganization}>
                  Create workspace
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}
