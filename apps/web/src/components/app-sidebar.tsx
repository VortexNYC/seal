"use client";

import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import {
  Code,
  Files,
  Gear,
  House,
  SquaresFour,
  Users,
  type Icon,
} from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import * as React from "react";

import {
  NavMain,
  type NavGroupItem,
  type NavPrimaryItem,
} from "@/components/nav-main";
import { SealLogo } from "@/components/seal-logo";
import { WorkspaceAccountMenu } from "@/components/workspace-account-menu";
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
      title: "Account",
      url: buildOrganizationPath(slug, "/settings/profile"),
      visible: true,
    },
    {
      title: "Signing",
      url: buildOrganizationPath(slug, "/settings/signing"),
      visible: canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Notifications",
      url: buildOrganizationPath(slug, "/settings/notifications"),
      visible: true,
    },
    {
      title: "Security",
      url: buildOrganizationPath(slug, "/settings/security"),
      visible: canView(permissionFlags?.canViewSettings),
    },
  ].filter((item) => item.visible);

  const developerItems = [
    {
      title: "Developer",
      url: buildOrganizationPath(slug, "/settings/developer"),
      visible:
        canView(permissionFlags?.canManageAPIKeys) ||
        canView(permissionFlags?.canManageWebhooks),
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
    <Sidebar {...props} className="border-sidebar-border bg-sidebar text-sidebar-foreground">
      <Sidebar.Header className="border-sidebar-border gap-0 border-b px-2 py-2">
        <div
          className="text-sidebar-foreground flex min-w-0 items-center gap-2 px-2 py-1"
          aria-label="Seal"
        >
          <SealLogo size={22} variant="color" />
          <span className="seal-wordmark font-serif text-[1.05rem] leading-none tracking-tight">
            Seal
          </span>
        </div>
      </Sidebar.Header>
      <Sidebar.Content className="px-1 pt-2">
        <NavMain primary={primary} groups={groups} />
      </Sidebar.Content>
      <Sidebar.Footer className="border-sidebar-border relative z-20 isolate gap-1 border-t px-1 py-2">
        {currentUser ? (
          <WorkspaceAccountMenu
            teams={teamOptions}
            activeSlug={activeTeamSlug}
            user={currentUser}
            onTeamSelect={handleTeamSelect}
            onCreateOrganization={() => {
              void navigate({
                to: "/onboarding/choose-organization",
                search: { create: true },
              });
            }}
            onOpenProfile={() => {
              void navigate({
                to: "/$slug/settings/profile",
                params: { slug },
              });
            }}
            onSignOut={handleSignOut}
          />
        ) : null}
      </Sidebar.Footer>
    </Sidebar>
  );
}
