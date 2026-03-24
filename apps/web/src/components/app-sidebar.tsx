"use client";

import { useClerk, useUser } from "@clerk/clerk-react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Moon, Sun } from "lucide-react";
import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { buildNavSections, type PermissionSet } from "@/components/sidebar-nav";
import { NavUser } from "@/components/nav-user";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { SealLogoBadgeFixed } from "@/components/seal-logo-fixed";
import { TeamSwitcher } from "@/components/team-switcher";
import { useTheme } from "@/components/theme-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAnalytics } from "@/hooks/use-analytics";
import { buildOrganizationPath } from "@/lib/organization-path";
import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

type SidebarOrganization = {
  _id: Id<"organizations">;
  name: string;
  slug: string;
};

type OrganizationListEntry = {
  organizationId: Id<"organizations">;
  organizationName: string;
  organizationSlug: string;
  role: string;
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  slug: string;
  organization: SidebarOrganization;
  permissions: PermissionSet | undefined;
};

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRole(value: string | undefined) {
  if (!value) {
    return "Member";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildTeamOptions({
  slug,
  organizations,
}: {
  slug: string;
  organizations: OrganizationListEntry[] | undefined;
}) {
  if (!organizations) {
    return [];
  }

  const sorted = [...organizations].sort((a, b) => {
    if (a.organizationSlug === slug) return -1;
    if (b.organizationSlug === slug) return 1;
    return a.organizationName.localeCompare(b.organizationName);
  });

  return sorted.map((organization) => {
    const initials = getInitials(organization.organizationName);

    const Logo = ({ className }: { className?: string }) => (
      <span
        className={cn(
          "grid h-full w-full place-items-center rounded-md bg-transparent text-[0.65rem] font-semibold uppercase",
          className,
        )}
      >
        {initials}
      </span>
    );

    return {
      name: organization.organizationName,
      plan: formatRole(organization.role),
      slug: organization.organizationSlug,
      logo: Logo,
    };
  });
}

export function AppSidebar({ slug, organization, permissions, ...props }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { reset: resetAnalytics } = useAnalytics();
  const organizations = useQuery(api.check_membership.listUserOrganizations);
  const connectedAccount = useQuery(api.stripe.connect_queries.getConnectedAccount, { slug });
  const hasStripeConnect = connectedAccount?.status === "connected";

  // Wrapper to reset PostHog identity before signing out
  const handleSignOut = React.useCallback(async () => {
    resetAnalytics();
    await signOut();
  }, [resetAnalytics, signOut]);

  const teamOptions = React.useMemo(
    () => buildTeamOptions({ slug, organizations }),
    [organizations, slug],
  );

  const navItems = React.useMemo(
    () =>
      buildNavSections({
        slug,
        currentPath: location.pathname,
        permissions,
        hasStripeConnect,
      }),
    [slug, location.pathname, permissions, hasStripeConnect],
  );

  const activeTeamSlug = slug;

  const currentUser = React.useMemo(() => {
    if (!user) return null;

    const name =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "User";

    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses[0]?.emailAddress ||
      "unknown@example.com";

    const initials = getInitials(name || email);

    return {
      name,
      email,
      avatar: user.imageUrl ?? "",
      initials,
    };
  }, [user]);

  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleThemeToggle = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const handleTeamSelect = React.useCallback(
    (nextSlug: string) => {
      if (!nextSlug || nextSlug === slug) {
        return;
      }

      let relativePath = location.pathname;
      if (relativePath.startsWith(`/${slug}`)) {
        relativePath = relativePath.slice(slug.length + 1);
      }

      const target = buildOrganizationPath(
        nextSlug,
        relativePath.length > 0 ? relativePath : "/home",
      );

      navigate({ to: target });
    },
    [location.pathname, navigate, slug],
  );

  if (!organization) {
    return null;
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link
          to="/$slug/home"
          params={{ slug: activeTeamSlug }}
          className="flex items-center justify-center py-2 group-data-[collapsible=icon]:hidden"
        >
          <SealLogoBadgeFixed size={64} withText />
        </Link>
        {teamOptions.length > 0 && (
          <TeamSwitcher
            teams={teamOptions}
            activeSlug={activeTeamSlug}
            onTeamSelect={handleTeamSelect}
          />
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2">
              <NotificationsPopover slug={slug} />
              <SidebarMenuButton
                className="ml-2 flex-1 justify-between"
                onClick={handleThemeToggle}
                aria-pressed={isDark}
              >
                <div className="flex items-center gap-2">
                  {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
                  <span className="group-data-[collapsible=icon]:hidden">Dark mode</span>
                </div>
                <span
                  aria-hidden="true"
                  className={cn(
                    "group-data-[collapsible=icon]:hidden inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
                    isDark ? "bg-primary border-primary justify-end" : "bg-muted border-border",
                  )}
                >
                  <span
                    className={cn(
                      "bg-background block h-4 w-4 rounded-full shadow-sm transition-transform",
                      isDark ? "-translate-x-0.5" : "translate-x-0.5",
                    )}
                  />
                </span>
              </SidebarMenuButton>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
        {currentUser && <NavUser user={currentUser} slug={slug} onSignOut={handleSignOut} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
