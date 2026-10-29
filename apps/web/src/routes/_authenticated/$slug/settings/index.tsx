import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AuthProvider,
  isOrganizationAdminRole,
  OrganizationBrandForm,
  OrganizationProfile,
  OrganizationRegionalForm,
  OrganizationSecurityForm,
} from "@vortex-api/better-auth-ui";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { FormSkeleton, PageFormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { pageSEO } from "@/lib/seo";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/$slug/settings/")({
  component: GeneralSettings,
  pendingComponent: () => <PageFormSkeleton title="General Settings" />,
  head: () => ({
    meta: [
      { title: pageSEO.settings.title },
      { name: "description", content: pageSEO.settings.description },
    ],
  }),
});

const SEAL_REGIONAL_DEFAULTS = {
  timezone: "UTC",
  currency: "BRL",
  currencyKind: "normal",
};

function GeneralSettings() {
  const client = getBetterAuthUiClient();

  if (client === null) {
    return (
      <PageWrapper title="General Settings">
        <FormSkeleton />
      </PageWrapper>
    );
  }

  return (
    <AuthProvider client={client}>
      <GeneralSettingsContent />
    </AuthProvider>
  );
}

function GeneralSettingsContent() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: organization } = useOrganization(slug);
  const isAdmin = isOrganizationAdminRole(organization?.userRole);

  if (organization === undefined) {
    return (
      <PageWrapper title="General Settings">
        <FormSkeleton />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="General Settings">
      <SettingsBody>
        <div className="flex flex-col gap-5">
          {organization && (
            <OrganizationProfile
              className="w-full max-w-none"
              organizationId={organization.id}
              onUpdated={(updated) => {
                void queryClient.invalidateQueries({
                  queryKey: ["organization", updated.slug],
                });
                if (updated.slug !== slug) {
                  void navigate({
                    to: "/$slug/settings",
                    params: { slug: updated.slug },
                  });
                }
              }}
              onDeleted={() => {
                void navigate({ to: "/" });
              }}
            />
          )}

          <OrganizationSecurityForm
            className="w-full max-w-none"
            disabled={!isAdmin}
            onSaved={() => {
              toast.success("Security policy saved");
              void queryClient.invalidateQueries({
                queryKey: ["organization", slug],
              });
            }}
          />
          <OrganizationBrandForm
            className="w-full max-w-none"
            disabled={!isAdmin}
            onSaved={() => {
              toast.success("Brand saved");
              void queryClient.invalidateQueries({
                queryKey: ["organization", slug],
              });
            }}
          />

          <OrganizationRegionalForm
            disabled={!isAdmin}
            defaults={SEAL_REGIONAL_DEFAULTS}
            onSaved={() => {
              toast.success("Regional defaults saved");
              void queryClient.invalidateQueries({
                queryKey: ["organization", slug],
              });
            }}
          />
        </div>
      </SettingsBody>
    </PageWrapper>
  );
}
