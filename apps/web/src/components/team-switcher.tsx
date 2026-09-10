"use client";

import {
  Building2,
  Check,
  ChevronDown,
  Plus,
} from "lucide-react";
import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

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

  const ActiveLogo = active?.logo ?? Building2;

  if (teams.length === 0) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              size="lg"
            >
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <ActiveLogo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {active?.name ?? "Workspace"}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {active?.plan ?? ""}
                </span>
              </div>
              <ChevronDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {teams.map((team) => {
              const Logo = team.logo;
              const isActive = team.slug === active?.slug;
              return (
                <DropdownMenuItem
                  key={team.slug}
                  className="gap-2 p-2"
                  onSelect={() => onTeamSelect?.(team.slug)}
                >
                  <div className="bg-muted flex size-6 items-center justify-center rounded-md">
                    <Logo className="size-3.5" />
                  </div>
                  <div className="grid flex-1 leading-tight">
                    <span className="truncate text-sm font-medium">{team.name}</span>
                    <span className="text-muted-foreground text-xs">{team.plan}</span>
                  </div>
                  {isActive && <Check className="ml-auto size-4" />}
                </DropdownMenuItem>
              );
            })}
            {onCreateOrganization && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onSelect={onCreateOrganization}
                >
                  <div className="bg-muted flex size-6 items-center justify-center rounded-md">
                    <Plus className="size-3.5" />
                  </div>
                  Create workspace
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
