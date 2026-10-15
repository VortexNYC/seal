import { Text } from "@cloudflare/kumo/components/text";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AuthProvider,
  OrganizationChooser,
  type AuthOrganization,
} from "@vortex-api/better-auth-ui";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { buildOrganizationPath } from "@/lib/organization-path";
import { rememberCreatedOrganization } from "@/lib/remember-created-organization";

interface ChooseOrganizationSearch {
  next?: string;
  create?: boolean;
}

export const Route = createFileRoute(
  "/_authenticated/onboarding/choose-organization/"
)({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>
  ): ChooseOrganizationSearch => {
    const result: ChooseOrganizationSearch = {};
    if (search.next === "developer") {
      result.next = "developer";
    }
    if (
      search.create === true ||
      search.create === "true" ||
      search.create === "1"
    ) {
      result.create = true;
    }
    return result;
  },
});

function RouteComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { next, create } = Route.useSearch();
  const client = getBetterAuthUiClient();

  const destination = (slug: string, created: boolean) =>
    buildOrganizationPath(
      slug,
      next === "developer"
        ? "/settings/developer"
        : created
          ? "/onboarding/compliance"
          : "/home"
    );

  function openWorkspace(organization: AuthOrganization, created: boolean) {
    if (created) {
      queryClient.setQueryData(
        ["auth", "organization", "list"],
        (current: Array<{ slug: string }> | undefined) =>
          rememberCreatedOrganization(current, organization)
      );
    }
    void navigate({
      to: destination(organization.slug, created),
      replace: true,
    });
  }

  if (client === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Text as="p" size="sm">
          Auth client not configured.
        </Text>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <AuthProvider client={client}>
        <OrganizationChooser
          startCreating={Boolean(create)}
          onOpen={(organization) => {
            openWorkspace(organization, false);
          }}
          onCreated={(organization) => {
            openWorkspace(organization, true);
          }}
        />
      </AuthProvider>
    </div>
  );
}
