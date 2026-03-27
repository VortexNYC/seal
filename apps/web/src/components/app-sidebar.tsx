"use client";

import { useClerk, useUser } from "@clerk/clerk-react";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Code2,
  CreditCard,
  LayoutTemplate,
  type LucideIcon,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import * as React from "react";

import { NavMain } from "@/components/nav-main";
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
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import { buildOrganizationPath } from "@/lib/organization-path";
import { cn } from "@/lib/utils";

type SidebarOrganization = {
  _id: Id<"organizations">;
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

type OrganizationListEntry = {
  organizationId: Id<"organizations">;
  organizationName: string;
  organizationSlug: string;
  role: string;
};

type NavMainItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive: boolean;
  items: {
    title: string;
    url: string;
    isActive: boolean;
    locked?: boolean;
  }[];
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

function isPathActive(currentPath: string, targetPath: string, exactMatch = false) {
  // Exact match - this is the primary check
  if (currentPath === targetPath) {
    return true;
  }

  // If exactMatch is required, don't check for child routes
  if (exactMatch) {
    return false;
  }

  // Check if the current path is a child route of the target path
  // For example: /org/settings/team/123 should match /org/settings/team
  return currentPath.startsWith(`${targetPath}/`);
}

function buildNavSections({
  slug,
  currentPath,
  permissions,
  hasStripeConnect,
  isPro,
}: {
  slug: string;
  currentPath: string;
  permissions: PermissionSet | undefined;
  hasStripeConnect: boolean;
  isPro: boolean;
}): NavMainItem[] {
  const permissionFlags = permissions?.permissions;
  const canView = (flag?: boolean) => (flag === undefined ? true : Boolean(flag));

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
      visible: hasStripeConnect && canView(permissionFlags?.canViewSettings),
      exactMatch: true,
    },
    {
      title: "Subscriptions",
      url: buildOrganizationPath(slug, "/payments/subscriptions"),
      visible: hasStripeConnect && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "History",
      url: buildOrganizationPath(slug, "/payments/history"),
      visible: hasStripeConnect && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Payouts",
      url: buildOrganizationPath(slug, "/payments/payouts"),
      visible: hasStripeConnect && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Balances",
      url: buildOrganizationPath(slug, "/payments/balances"),
      visible: hasStripeConnect && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Disputes",
      url: buildOrganizationPath(slug, "/payments/disputes"),
      visible: hasStripeConnect && canView(permissionFlags?.canViewSettings),
    },
    {
      title: "Tax Documents",
      url: buildOrganizationPath(slug, "/payments/tax"),
      visible: hasStripeConnect && canView(permissionFlags?.canViewSettings),
    },
  ].filter((item) => item.visible);

  const settingsItems = [
    {
      title: "General",
      url: buildOrganizationPath(slug, "/settings"),
      visible: canView(permissionFlags?.canViewSettings),
      exactMatch: true, // General should only match /settings, not child routes
    },
    {
      title: "Team",
      url: buildOrganizationPath(slug, "/settings/team"),
      visible: canView(permissionFlags?.canViewMembers),
    },
    {
      title: "Profile",
      url: buildOrganizationPath(slug, "/settings/profile"),
      visible: true, // Profile settings are always visible to the user
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
        canView(permissionFlags?.canViewBilling) || canView(permissionFlags?.canManageBilling),
    },
    {
      title: "Stripe Connect",
      url: buildOrganizationPath(slug, "/settings/payments"),
      visible: canView(permissionFlags?.canViewSettings),
    },
  ].filter((item) => item.visible);

  const developerItems = [
    {
      title: "API Keys",
      url: buildOrganizationPath(slug, "/settings/developer/api-keys"),
      visible:
        canView(permissionFlags?.canManageAPIKeys) || canView(permissionFlags?.canManageWebhooks),
      proGated: true,
    },
    {
      title: "Webhooks",
      url: buildOrganizationPath(slug, "/settings/developer/webhooks"),
      visible: canView(permissionFlags?.canManageWebhooks),
      proGated: true,
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
      icon: LayoutTemplate,
      items: workspaceItems,
    },
    {
      title: "Payments",
      icon: CreditCard,
      items: paymentsItems,
    },
    {
      title: "Settings",
      icon: Settings,
      items: settingsItems,
    },
    {
      title: "Developer",
      icon: Code2,
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
          "exactMatch" in item ? Boolean(item.exactMatch) : false,
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
  const { isPro } = useSubscriptionLimits();

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
        isPro,
      }),
    [slug, location.pathname, permissions, hasStripeConnect, isPro],
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
                    "inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors group-data-[collapsible=icon]:hidden",
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
