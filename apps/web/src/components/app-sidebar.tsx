"use client";

import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import {
  Code,
  CreditCard,
  Gear,
  Moon,
  SquaresFour,
  Sun,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { NotificationsPopover } from "@/components/notifications/notifications-popover";
import { SealLogoBadgeFixed } from "@/components/seal-logo-fixed";
import { TeamSwitcher } from "@/components/team-switcher";
import { useTheme } from "@/components/theme-provider";
import { useAnalytics } from "@/hooks/use-analytics";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import { betterAuthClient } from "@/lib/better-auth";
import { buildOrganizationPath } from "@/lib/organization-path";
import { cn } from "@/lib/utils";

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

type NavMainItem = {
  title: string;
  url: string;
  icon: Icon;
  isActive: boolean;
  items: {
    title: string;
    url: string;
    isActive: boolean;
    locked?: boolean;
  }[];
};

type AppSidebarProps = Omit<
  React.ComponentProps<typeof Sidebar>,
  "children"
> & {
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

function buildNavSections({
  slug,
  currentPath,
  permissions,
  isPro,
}: {
  slug: string;
  currentPath: string;
  permissions: PermissionSet | undefined;
  isPro: boolean;
}): NavMainItem[] {
  const permissionFlags = permissions?.permissions;

  const workspaceItems = [
    {
      title: "Dashboard",
      url: buildOrganizationPath(slug, "/home"),
      visible: true,
    },
    {
      title: "Documents",
      url: buildOrganizationPath(slug, "/documents"),
      visible: canView(permissionFlags?.canCreateDocuments),
    },
    {
      title: "Templates",
      url: buildOrganizationPath(slug, "/templates"),
      visible: canView(permissionFlags?.canCreateTemplates),
    },
    {
      title: "Contacts",
      url: buildOrganizationPath(slug, "/contacts"),
      visible: canView(permissionFlags?.canViewContacts),
    },
    {
      title: "Analytics",
      url: buildOrganizationPath(slug, "/analytics"),
      visible: true,
    },
  ].filter((item) => item.visible);

  const paymentsItems = [
    {
      title: "Overview",
      url: buildOrganizationPath(slug, "/payments"),
      visible: isPro && canView(permissionFlags?.canViewSettings),
      exactMatch: true,
    },
    {
      title: "Subscriptions",
      url: buildOrganizationPath(slug, "/payments/subscriptions"),
      visible: isPro && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "History",
      url: buildOrganizationPath(slug, "/payments/history"),
      visible: isPro && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Payouts",
      url: buildOrganizationPath(slug, "/payments/payouts"),
      visible: isPro && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Balances",
      url: buildOrganizationPath(slug, "/payments/balances"),
      visible: isPro && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Disputes",
      url: buildOrganizationPath(slug, "/payments/disputes"),
      visible: isPro && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Tax Documents",
      url: buildOrganizationPath(slug, "/payments/tax"),
      visible: isPro && canView(permissionFlags?.canViewSettings),
    },
  ].filter((item) => item.visible);

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
    {
      title: "Billing",
      url: buildOrganizationPath(slug, "/settings/billing"),
      visible:
        canView(permissionFlags?.canViewBilling) ||
        canView(permissionFlags?.canManageBilling),
    },
    {
      title: "Merchant Payments",
      url: buildOrganizationPath(slug, "/settings/payments"),
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

  const sections = [
    {
      title: "Workspace",
      icon: SquaresFour,
      items: workspaceItems,
    },
    {
      title: "Payments",
      icon: CreditCard,
      items: paymentsItems,
    },
    {
      title: "Settings",
      icon: Gear,
      items: settingsItems,
    },
    {
      title: "Developer",
      icon: Code,
      items: developerItems,
    },
  ];

  return sections
    .map((section) => {
      if (section.items.length === 0) {
        return null;
      }

      const items: NavMainItem["items"] = section.items.map((item) => ({
        title: item.title,
        url: item.url,
        isActive: isPathActive(
          currentPath,
          item.url,
          "exactMatch" in item ? Boolean(item.exactMatch) : false
        ),
        locked: "proGated" in item && Boolean(item.proGated) && !isPro,
      }));

      return {
        title: section.title,
        url: items[0]?.url ?? "#",
        icon: section.icon,
        isActive: items.some((item) => item.isActive),
        items,
      };
    })
    .filter((section): section is NavMainItem => section !== null);
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

  return sorted.map((organization) => {
    const initials = getInitials(organization.name);

    const Logo = ({ className }: { className?: string }) => (
      <span
        className={cn(
          "grid h-full w-full place-items-center rounded-md bg-transparent text-[0.65rem] font-semibold uppercase",
          className
        )}
      >
        {initials}
      </span>
    );

    return {
      id: organization.id,
      name: organization.name,
      plan: "Member",
      slug: organization.slug,
      logo: Logo,
    };
  });
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

  const navItems = React.useMemo(
    () =>
      buildNavSections({
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
      <Sidebar.Header>
        <Link
          to="/$slug/home"
          params={{ slug: activeTeamSlug }}
          className="flex items-center justify-center py-2"
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
      </Sidebar.Header>
      <Sidebar.Content>
        <NavMain items={navItems} />
      </Sidebar.Content>
      <Sidebar.Footer>
        <Sidebar.Menu>
          <Sidebar.MenuItem>
            <div className="flex items-center justify-between px-2">
              <NotificationsPopover slug={slug} organizationSlug={slug} />
              <Sidebar.MenuButton
                className="ml-2 flex-1 justify-between"
                onClick={handleThemeToggle}
                aria-pressed={isDark}
              >
                <div className="flex items-center gap-2">
                  {isDark ? (
                    <Moon className="size-4" />
                  ) : (
                    <Sun className="size-4" />
                  )}
                  <span>Dark mode</span>
                </div>
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
                    isDark
                      ? "bg-kumo-primary border-kumo-primary justify-end"
                      : "bg-kumo-surface border-kumo-hairline"
                  )}
                >
                  <span
                    className={cn(
                      "bg-kumo-background block h-4 w-4 rounded-full shadow-sm transition-transform",
                      isDark ? "-translate-x-0.5" : "translate-x-0.5"
                    )}
                  />
                </span>
              </Sidebar.MenuButton>
            </div>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
        {currentUser && (
          <NavUser user={currentUser} slug={slug} onSignOut={handleSignOut} />
        )}
      </Sidebar.Footer>
      <Sidebar.Rail />
    </Sidebar>
  );
}
