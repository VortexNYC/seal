import { Badge } from "@cloudflare/kumo/components/badge";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import { Sidebar, useSidebar } from "@cloudflare/kumo/components/sidebar";
import {
  CaretUpDown,
  CreditCard,
  SignOut,
  Sparkle,
  User,
} from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOrganization } from "@/hooks/use-organization";

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
  const { data: organization } = useOrganization(slug);
  const plan = organization?.plan ?? "free";
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  const isPro = plan === "pro";

  return (
    <Sidebar.Menu>
      <Sidebar.MenuItem>
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Sidebar.MenuButton size="base" className="group">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.initials ?? "CN"}
                </AvatarFallback>
              </Avatar>
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
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {user.initials ?? "CN"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenu.Label>
            <DropdownMenu.Separator />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-kumo-secondary text-xs">Plan</span>
              <Badge
                variant={isPro ? "primary" : "secondary"}
                icon={isPro ? Sparkle : undefined}
                className="text-xs"
              >
                {planName}
              </Badge>
            </div>
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
              <DropdownMenu.Item
                icon={CreditCard}
                onClick={() =>
                  navigate({
                    to: "/$slug/settings/billing",
                    params: { slug },
                  })
                }
              >
                Billing
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
