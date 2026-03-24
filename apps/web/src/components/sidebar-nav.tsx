import { Code2, CreditCard, LayoutTemplate, type LucideIcon, Settings } from "lucide-react";

import { buildOrganizationPath } from "@/lib/organization-path";

export type NavMainItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive: boolean;
  items: {
    title: string;
    url: string;
    isActive: boolean;
  }[];
};

export type PermissionSet = {
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

export function isPathActive(currentPath: string, targetPath: string, exactMatch = false) {
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

function canView(flag?: boolean) {
  return flag === undefined ? true : Boolean(flag);
}

export function buildNavSections({
  slug,
  currentPath,
  permissions,
  hasStripeConnect,
}: {
  slug: string;
  currentPath: string;
  permissions: PermissionSet | undefined;
  hasStripeConnect: boolean;
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

      const items = section.items.map((item) => ({
        title: item.title,
        url: item.url,
        isActive: isPathActive(
          currentPath,
          item.url,
          "exactMatch" in item ? Boolean(item.exactMatch) : false,
        ),
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
