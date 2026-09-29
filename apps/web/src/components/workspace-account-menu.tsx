"use client";

/**
 * One footer control: active workspace + account.
 * Replaces separate TeamSwitcher + NavUser stacks.
 */

import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Sidebar, useSidebar } from "@cloudflare/kumo/components/sidebar";
import {
  Buildings,
  CaretUpDown,
  Plus,
  SignOut,
  User,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

type Team = {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
};

function Mark({
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
        "grid size-full place-items-center rounded-md text-[0.7rem] font-semibold uppercase",
        className
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function WorkspaceAccountMenu({
  teams,
  activeSlug,
  user,
  onTeamSelect,
  onCreateOrganization,
  onOpenProfile,
  onSignOut,
}: {
  teams: Team[];
  activeSlug?: string;
  user: {
    name: string;
    email: string;
    avatar: string;
    initials?: string;
  };
  onTeamSelect?: (slug: string) => void;
  onCreateOrganization?: () => void;
  onOpenProfile?: () => void;
  onSignOut?: () => Promise<void> | void;
}): React.JSX.Element {
  const { isMobile } = useSidebar();
  const active =
    teams.find((team) => team.slug === activeSlug) ?? teams[0] ?? null;

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Sidebar.MenuButton
              size="base"
              className="group"
              aria-label={`Workspace ${active?.name ?? "Seal"} — ${user.name}`}
            >
              <div className="bg-sidebar-accent text-sidebar-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg">
                {active ? (
                  <Mark name={active.name} logoUrl={active.logoUrl} />
                ) : (
                  <Buildings className="size-4" />
                )}
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="text-muted-foreground truncate text-[10px] font-medium tracking-wide uppercase">
                  Workspace
                </span>
                <span className="text-sidebar-foreground truncate font-medium">
                  {active?.name ?? "Workspace"}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  Signed in as {user.name}
                </span>
              </div>
              <CaretUpDown className="text-muted-foreground ml-auto size-4 shrink-0" />
            </Sidebar.MenuButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            className="min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "top"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenu.Group>
              <DropdownMenu.Label>Switch workspace</DropdownMenu.Label>
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
                      <Mark name={team.name} logoUrl={team.logoUrl} />
                    </div>
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm font-medium">
                        {team.name}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
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
                  <DropdownMenu.Item
                    icon={Plus}
                    onClick={onCreateOrganization}
                  >
                    Create workspace
                  </DropdownMenu.Item>
                </DropdownMenu.Group>
              </>
            ) : null}
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.Label>Account</DropdownMenu.Label>
              <DropdownMenu.Label className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <div className="bg-sidebar-accent overflow-hidden rounded-lg">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt=""
                        className="size-8 object-cover"
                      />
                    ) : (
                      <div className="text-muted-foreground flex size-8 items-center justify-center text-xs font-medium">
                        {user.initials ?? "U"}
                      </div>
                    )}
                  </div>
                  <div className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenu.Label>
              <DropdownMenu.Item icon={User} onClick={() => onOpenProfile?.()}>
                Profile settings
              </DropdownMenu.Item>
            </DropdownMenu.Group>
            <DropdownMenu.Separator />
            <DropdownMenu.Item icon={SignOut} onClick={() => onSignOut?.()}>
              Log out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </Sidebar.MenuItem>
    </Sidebar.Menu>
  );
}
