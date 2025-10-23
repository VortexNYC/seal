/**
 * Settings Layout Route
 *
 * Layout for all settings pages with navigation tabs
 * Route: /{slug}/settings/*
 */

import { createFileRoute, Outlet, Link, useMatchRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@seal/backend/convex/_generated/api';
import type { Id } from '@seal/backend/convex/_generated/dataModel';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/_authenticated/$slug/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  const { slug } = Route.useParams();
  const matchRoute = useMatchRoute();

  // Fetch organization details
  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  if (!organization) {
    return <div>Loading...</div>;
  }

  const orgId = organization._id as Id<"organizations">;

  // Fetch permissions
  const permissions = useQuery(api.organizations.queries.getUserPermissions, {
    organizationId: orgId,
  });

  const settingsNavItems = [
    {
      title: 'General',
      href: `/${slug}/settings`,
      show: permissions?.permissions.canViewSettings !== false,
    },
    {
      title: 'Team',
      href: `/${slug}/settings/team`,
      show: permissions?.permissions.canViewMembers !== false,
    },
    {
      title: 'Billing',
      href: `/${slug}/settings/billing`,
      show: permissions?.permissions.canViewBilling !== false,
    },
    {
      title: 'Webhooks',
      href: `/${slug}/settings/webhooks`,
      show: permissions?.permissions.canManageWebhooks !== false,
    },
    {
      title: 'API Keys',
      href: `/${slug}/settings/api`,
      show: permissions?.permissions.canManageAPIKeys !== false,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your workspace settings and preferences
        </p>
      </div>

      <Separator />

      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="lg:w-1/5">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
            {settingsNavItems
              .filter((item) => item.show)
              .map((item) => {
                const isActive = matchRoute({ to: item.href, fuzzy: false });

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {item.title}
                  </Link>
                );
              })}
          </nav>
        </aside>

        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
