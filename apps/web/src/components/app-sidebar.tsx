"use client";

import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import {
  ChartBar,
  Code,
  Files,
  Gear,
  House,
  Moon,
  SquaresFour,
  Sun,
  Users,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import * as React from "react";

import {
  NavMain,
  type NavGroupItem,
  type NavPrimaryItem,
} from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { SealLogo } from "@/components/seal-logo";
import { TeamSwitcher } from "@/components/team-switcher";
import { useTheme } from "@/components/theme-provider";
import { useAnalytics } from "@/hooks/use-analytics";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import { betterAuthClient } from "@/lib/better-auth";
import { buildOrganizationPath } from "@/lib/organization-path";

type SidebarOrganization = {
  id: string;
  name: string;
  slug: string;
};

type PermissionSet = {
  role: string;
  status: string;
  isPrimary: boolean;
  permissions: {
    canCreateDocuments: boolean;
    canCreateTemplates: boolean;
    canViewSettings: boolean;
    canViewMembers: boolean;
    canManageWebhooks: boolean;
    canManageAPIKeys: boolean;
    canManageBilling?: boolean;
    canViewBilling?: boolean;
    canViewContacts?: boolean;
  };
} | null;

type AppSidebarProps = Omit<
  React.ComponentProps<typeof Sidebar>,
  "children"
> & {
  slug: string;
  organization: SidebarOrganization;
  permissions: PermissionSet | undefined;
};

type BuiltNav = {
  primary: NavPrimaryItem[];
  groups: NavGroupItem[];
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

function isPathActive(
  currentPath: string,
  targetPath: string,
  exactMatch = false
) {
  if (currentPath === targetPath) {
    return true;
  }

  if (exactMatch) {
    return false;
  }

  return currentPath.startsWith(`${targetPath}/`);
}

function canView(flag?: boolean): boolean {
  return flag ?? true;
}

function buildNav({
  slug,
  currentPath,
  permissions,
  isPro,
}: {
  slug: string;
  currentPath: string;
  permissions: PermissionSet | undefined;
  isPro: boolean;
}): BuiltNav {
  const permissionFlags = permissions?.permissions;

  const primary: NavPrimaryItem[] = [
    {
      title: "Dashboard",
      url: buildOrganizationPath(slug, "/home"),
      icon: House,
      visible: true,
    },
    {
      title: "Documents",
      url: buildOrganizationPath(slug, "/documents"),
      icon: Files,
      visible: canView(permissionFlags?.canCreateDocuments),
    },
    {
      title: "Templates",
      url: buildOrganizationPath(slug, "/templates"),
      icon: SquaresFour,
      visible: canView(permissionFlags?.canCreateTemplates),
    },
    {
      title: "Contacts",
      url: buildOrganizationPath(slug, "/contacts"),
      icon: Users,
      visible: canView(permissionFlags?.canViewContacts),
    },
    {
      title: "Analytics",
      url: buildOrganizationPath(slug, "/analytics"),
      icon: ChartBar,
      visible: true,
    },
  ]
    .filter((item) => item.visible)
    .map(({ title, url, icon }) => ({
      title,
      url,
      icon,
      isActive: isPathActive(currentPath, url, title === "Dashboard"),
    }));

  const settingsItems = [
    {
      title: "General",
      url: buildOrganizationPath(slug, "/settings"),
      visible: canView(permissionFlags?.canViewSettings),
      exactMatch: true,
    },
    {
      title: "Team",
      url: buildOrganizationPath(slug, "/settings/team"),
      visible: canView(permissionFlags?.canViewMembers),
    },
    {
      title: "Profile",
      url: buildOrganizationPath(slug, "/settings/profile"),
      visible: true,
    },
    {
      title: "AI",
      url: buildOrganizationPath(slug, "/settings/ai"),
      visible: canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Branding",
      url: buildOrganizationPath(slug, "/settings/branding"),
      visible: canView(permissionFlags?.canViewSettings),
      proGated: true,
    },
    {
      title: "Signing",
      url: buildOrganizationPath(slug, "/settings/signing"),
      visible: canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Notifications",
      url: buildOrganizationPath(slug, "/settings/notifications"),
      visible: canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Security",
      url: buildOrganizationPath(slug, "/settings/security"),
      visible: canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Audit Log",
      url: buildOrganizationPath(slug, "/settings/audit-log"),
      visible: canView(permissionFlags?.canViewSettings),
    },
  ].filter((item) => item.visible);

  const developerItems = [
    {
      title: "API Keys",
      url: buildOrganizationPath(slug, "/settings/developer/api-keys"),
      visible:
        canView(permissionFlags?.canManageAPIKeys) ||
        canView(permissionFlags?.canManageWebhooks),
    },
    {
      title: "Webhooks",
      url: buildOrganizationPath(slug, "/settings/developer/webhooks"),
      visible: canView(permissionFlags?.canManageWebhooks),
    },
    {
      title: "Documentation",
      url: "/docs",
      visible: true,
    },
  ].filter((item) => item.visible);

  const groups: NavGroupItem[] = [];

  if (settingsItems.length > 0) {
    const items = settingsItems.map((item) => ({
      title: item.title,
      url: item.url,
      isActive: isPathActive(
        currentPath,
        item.url,
        "exactMatch" in item ? Boolean(item.exactMatch) : false
      ),
      locked: "proGated" in item && Boolean(item.proGated) && !isPro,
    }));
    groups.push({
      title: "Settings",
      icon: Gear as Icon,
      isActive: items.some((item) => item.isActive),
      items,
    });
  }

  if (developerItems.length > 0) {
    const items = developerItems.map((item) => ({
      title: item.title,
      url: item.url,
      isActive: isPathActive(currentPath, item.url),
    }));
    groups.push({
      title: "Developer",
      icon: Code as Icon,
      isActive: items.some((item) => item.isActive),
      items,
    });
  }

  return { primary, groups };
}

type OrganizationListItem = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null | undefined;
};

function buildTeamOptions({
  slug,
  organizations,
}: {
  slug: string;
  organizations: OrganizationListItem[] | null | undefined;
}) {
  if (!organizations) {
    return [];
  }

  const sorted = organizations.toSorted((a, b) => {
    if (a.slug === slug) return -1;
    if (b.slug === slug) return 1;
    return a.name.localeCompare(b.name);
  });

  return sorted.map((organization) => ({
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    logoUrl: organization.logo ?? null,
  }));
}

export function AppSidebar({
  slug,
  organization,
  permissions,
  ...props
}: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { reset: resetAnalytics } = useAnalytics();
  const { data: organizations } = useQuery({
    queryKey: ["auth", "organization", "list"],
    queryFn: async () => {
      if (betterAuthClient === null) {
        throw new Error("Better Auth is not configured");
      }
      const result = await betterAuthClient.organization.list();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
  const setActiveOrganizationMutation = useMutation({
    mutationFn: async (organizationSlug: string) => {
      if (betterAuthClient === null) {
        throw new Error("Better Auth is not configured");
      }
      const result = await betterAuthClient.organization.setActive({
        organizationSlug,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
  const { isPro } = useSubscriptionLimits();

  const handleSignOut = React.useCallback(async () => {
    resetAnalytics();
    if (betterAuthClient === null) {
      return;
    }
    const result = await betterAuthClient.signOut();
    if (result.error) {
      console.error("Failed to sign out:", result.error);
      return;
    }
    void navigate({ to: "/sign-in" });
  }, [resetAnalytics, navigate]);

  const teamOptions = React.useMemo(
    () => buildTeamOptions({ slug, organizations }),
    [organizations, slug]
  );

  const { primary, groups } = React.useMemo(
    () =>
      buildNav({
        slug,
        currentPath: location.pathname,
        permissions,
        isPro,
      }),
    [slug, location.pathname, permissions, isPro]
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
    async (nextSlug: string) => {
      if (!nextSlug || nextSlug === slug) {
        return;
      }

      try {
        await setActiveOrganizationMutation.mutateAsync(nextSlug);

        let relativePath = location.pathname;
        if (relativePath.startsWith(`/${slug}`)) {
          relativePath = relativePath.slice(slug.length + 1);
        }

        const target = buildOrganizationPath(
          nextSlug,
          relativePath.length > 0 ? relativePath : "/home"
        );

        void navigate({ to: target });
      } catch (error) {
        console.error("Failed to switch workspace:", error);
      }
    },
    [location.pathname, navigate, setActiveOrganizationMutation, slug]
  );

  if (!organization) {
    return null;
  }

  return (
    <Sidebar {...props}>
      <Sidebar.Header className="gap-3 border-b border-kumo-hairline/60 px-3 py-3">
        <Link
          to="/$slug/home"
          params={{ slug: activeTeamSlug }}
          className="flex items-center gap-2 px-1 py-0.5"
        >
          <SealLogo size={22} variant="color" />
          <span className="font-serif text-[1.05rem] leading-none tracking-tight">
            Seal
          </span>
        </Link>
        {teamOptions.length > 0 ? (
          <TeamSwitcher
            teams={teamOptions}
            activeSlug={activeTeamSlug}
            onTeamSelect={handleTeamSelect}
            onCreateOrganization={() => {
              void navigate({
                to: "/onboarding/choose-organization",
                search: { create: true },
              });
            }}
          />
        ) : null}
      </Sidebar.Header>
      <Sidebar.Content className="px-1 pt-2">
        <NavMain primary={primary} groups={groups} />
      </Sidebar.Content>
      <Sidebar.Footer className="gap-1 border-t border-kumo-hairline/60">
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <div className="flex items-center gap-1 px-1">
              <NotificationsPopover slug={slug} organizationSlug={slug} />
              <Sidebar.MenuButton
                className="size-8 shrink-0 justify-center px-0"
                onClick={handleThemeToggle}
                aria-pressed={isDark}
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                tooltip={isDark ? "Light mode" : "Dark mode"}
              >
                {isDark ? (
                  <Moon className="size-4" />
                ) : (
                  <Sun className="size-4" />
                )}
              </Sidebar.MenuButton>
            </div>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
        {currentUser ? (
          <NavUser user={currentUser} slug={slug} onSignOut={handleSignOut} />
        ) : null}
      </Sidebar.Footer>
      <Sidebar.Rail />
    </Sidebar>
  );
}
