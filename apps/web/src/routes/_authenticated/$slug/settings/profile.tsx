/**
 * Profile Settings Layout — Account + Security only.
 * Notifications → workspace Notifications; Usage/Integrations stay deep-linkable.
 */

import { Link as KumoLink } from "@cloudflare/kumo/components/link";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Text } from "@cloudflare/kumo/components/text";
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";

export const Route = createFileRoute("/_authenticated/$slug/settings/profile")({
  component: ProfileLayout,
});

function ProfileLayout() {
  const { slug } = Route.useParams();
  const location = useLocation();
  const router = useRouter();
  const section = location.pathname.endsWith("/security")
    ? "security"
    : location.pathname.endsWith("/profile")
      ? "account"
      : "";

  return (
    <PageWrapper title="Account">
      <div className="flex w-full flex-col gap-5 lg:flex-row lg:gap-8">
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-56">
          <Tabs
            variant="segmented"
            size="sm"
            value={section}
            onValueChange={(value) => {
              if (value !== "account" && value !== "security") return;
              void router.navigate({
                to:
                  value === "security"
                    ? "/$slug/settings/profile/security"
                    : "/$slug/settings/profile",
                params: { slug },
              });
            }}
            tabs={[
              { value: "account", label: "Account" },
              { value: "security", label: "Security" },
            ]}
          />
          <div className="flex flex-col gap-1">
            <KumoLink
              variant="plain"
              render={
                <Link to="/$slug/settings/notifications" params={{ slug }} />
              }
            >
              Notifications
            </KumoLink>
            <KumoLink
              variant="plain"
              render={
                <Link to="/$slug/settings/profile/usage" params={{ slug }} />
              }
            >
              Usage
            </KumoLink>
            <KumoLink
              variant="plain"
              render={
                <Link
                  to="/$slug/settings/profile/integrations"
                  params={{ slug }}
                />
              }
            >
              Integrations
            </KumoLink>
          </div>
          <Text variant="secondary" size="xs">
            Account covers name and email. Security covers password and MFA.
          </Text>
        </aside>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </PageWrapper>
  );
}
