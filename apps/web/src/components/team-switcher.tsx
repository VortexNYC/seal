"use client";

import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Buildings, CaretDown, Plus } from "@phosphor-icons/react";
import * as React from "react";

import { cn } from "@/lib/utils";

type Team = {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  plan?: string;
};

function WorkspaceMark({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}): React.JSX.Element {
  const initial = name.trim().charAt(0).toUpperCase() || "W";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn("size-full rounded-md object-cover", className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "text-2xs grid size-full place-items-center rounded-md font-semibold uppercase",
        className
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}

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
}): React.JSX.Element | null {
  const active = React.useMemo(
    () => teams.find((team) => team.slug === activeSlug) ?? teams[0] ?? null,
    [teams, activeSlug]
  );

  if (teams.length === 0) {
    return null;
  }

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Sidebar.MenuButton
              size="base"
              className="group"
              aria-label={`Workspace: ${active?.name ?? "Select workspace"}`}
            >
              <div className="bg-sidebar-accent text-sidebar-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
                {active ? (
                  <WorkspaceMark name={active.name} logoUrl={active.logoUrl} />
                ) : (
                  <Buildings className="size-4" />
                )}
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="text-sidebar-foreground truncate font-medium">
                  {active?.name ?? "Workspace"}
                </span>
              </div>
              <CaretDown className="text-muted-foreground ml-auto size-4 shrink-0" />
            </Sidebar.MenuButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            align="start"
            className="min-w-64"
            side="top"
            sideOffset={4}
          >
            <DropdownMenu.Group>
              <DropdownMenu.Label>Workspaces</DropdownMenu.Label>
              {teams.map((team) => {
                const isActive = team.slug === active?.slug;
                return (
                  <DropdownMenu.Item
                    key={team.slug}
                    selected={isActive}
                    onClick={() => onTeamSelect?.(team.slug)}
                    aria-label={team.name}
                  >
                    <div
                      className="bg-sidebar-accent text-sidebar-foreground flex size-7 shrink-0 items-center justify-center rounded-md"
                      aria-hidden
                    >
                      <WorkspaceMark name={team.name} logoUrl={team.logoUrl} />
                    </div>
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm font-medium">
                        {team.name}
                      </span>
                      <span className="text-kumo-secondary truncate text-xs">
                        {team.slug}
                      </span>
                    </div>
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Group>
            {onCreateOrganization ? (
              <>
                <DropdownMenu.Separator />
                <DropdownMenu.Group>
                  <DropdownMenu.Item icon={Plus} onClick={onCreateOrganization}>
                    Create workspace
                  </DropdownMenu.Item>
                </DropdownMenu.Group>
              </>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}
