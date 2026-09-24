import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Sidebar, useSidebar } from "@cloudflare/kumo/components/sidebar";
import { CaretUpDown, SignOut, User } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

function UserAvatar({
  avatar,
  name,
  initials,
  className,
}: {
  avatar: string;
  name: string;
  initials?: string;
  className?: string;
}) {
  const fallback = initials ?? "CN";
  return (
    <div
      className={cn("bg-kumo-elevated overflow-hidden rounded-lg", className)}
    >
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="text-kumo-secondary flex h-full w-full items-center justify-center text-xs font-medium">
          {fallback}
        </div>
      )}
    </div>
  );
}

export function NavUser({
  user,
  slug,
  onSignOut,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
    initials?: string;
  };
  slug: string;
  onSignOut?: () => Promise<void> | void;
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Sidebar.MenuButton size="base" className="group">
              <UserAvatar
                avatar={user.avatar}
                name={user.name}
                initials={user.initials}
                className="h-8 w-8"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <CaretUpDown className="ml-auto size-4" />
            </Sidebar.MenuButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenu.Label className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar
                  avatar={user.avatar}
                  name={user.name}
                  initials={user.initials}
                  className="h-8 w-8"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenu.Label>
            <DropdownMenu.Separator />
            <DropdownMenu.Group>
              <DropdownMenu.Item
                icon={User}
                onClick={() =>
                  navigate({ to: "/$slug/settings/profile", params: { slug } })
                }
              >
                Profile
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
