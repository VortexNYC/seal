/**
 * Profile Settings Layout — Account + Security only.
 * Notifications → workspace Notifications; Usage/Integrations stay deep-linkable.
 */

import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { Shield, User } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$slug/settings/profile")({
  component: ProfileLayout,
});

type ProfileNavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  description: string;
};

function ProfileLayout() {
  const { slug } = Route.useParams();
  const location = useLocation();

  const navItems: ProfileNavItem[] = [
    {
      title: "Account",
      href: `/${slug}/settings/profile`,
      icon: User,
      description: "Name and email",
    },
    {
      title: "Security",
      href: `/${slug}/settings/profile/security`,
      icon: Shield,
      description: "Password and MFA",
    },
  ];

  return (
    <PageWrapper title="Account">
      <div className="flex w-full flex-col gap-5 lg:flex-row lg:gap-8">
        <aside className="w-full shrink-0 lg:w-56">
          <nav className="flex flex-col gap-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground"
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-muted-foreground text-xs">
                      {item.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
          <div className="text-muted-foreground mt-4 flex flex-col gap-1 px-3 text-xs">
            <Link
              to="/$slug/settings/notifications"
              params={{ slug }}
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Notifications
            </Link>
            <Link
              to="/$slug/settings/profile/usage"
              params={{ slug }}
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Usage
            </Link>
            <Link
              to="/$slug/settings/profile/integrations"
              params={{ slug }}
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Integrations
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </PageWrapper>
  );
}
