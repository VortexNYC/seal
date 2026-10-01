import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { FloppyDisk } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AuthProvider,
  isOrganizationAdminRole,
  OrganizationProfile,
  useAuth,
} from "@vortex-api/better-auth-ui";
import { useEffect, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { FormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { pageSEO } from "@/lib/seo";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/$slug/settings/")({
  component: GeneralSettings,
  pendingComponent: FormSkeleton,
  head: () => ({
    meta: [
      { title: pageSEO.settings.title },
      { name: "description", content: pageSEO.settings.description },
    ],
  }),
});

interface ProductFormData {
  timezone: string;
  currency: string;
  currencyKind: string;
}

const DEFAULT_PRODUCT: ProductFormData = {
  timezone: "UTC",
  currency: "BRL",
  currencyKind: "normal",
};

function productFromMetadata(
  metadata: Record<string, unknown> | undefined
): ProductFormData {
  if (metadata === undefined) {
    return DEFAULT_PRODUCT;
  }
  return {
    timezone:
      typeof metadata.timezone === "string"
        ? metadata.timezone
        : DEFAULT_PRODUCT.timezone,
    currency:
      typeof metadata.currency === "string"
        ? metadata.currency
        : DEFAULT_PRODUCT.currency,
    currencyKind:
      typeof metadata.currencyKind === "string"
        ? metadata.currencyKind
        : DEFAULT_PRODUCT.currencyKind,
  };
}

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
  const client = useAuth();
  const { data: organization } = useOrganization(slug);

  const [product, setProduct] = useState<ProductFormData>(DEFAULT_PRODUCT);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setProduct(productFromMetadata(organization?.metadata));
  }, [organization]);

  const isAdmin = isOrganizationAdminRole(organization?.userRole);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      client.organization?.update === undefined ||
      organization?.id === undefined
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const existingMetadata = organization.metadata ?? {};

      const response = await client.organization.update({
        organizationId: organization.id,
        data: {
          metadata: {
            ...existingMetadata,
            timezone: product.timezone,
            currency: product.currency,
            currencyKind: product.currencyKind,
          },
        },
      });

      if (response.error !== null) {
        toast.error(
          response.error.message ?? "Could not update workspace settings."
        );
      } else {
        toast.success("Workspace settings updated successfully.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update workspace settings."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (organization === undefined) {
    return (
      <PageWrapper title="General Settings">
        <FormSkeleton />
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="General Settings">
      <SettingsBody wide>
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

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold tracking-tight">
                Regional defaults
              </h2>
              <p className="text-muted-foreground text-sm">
                Product defaults for documents and payments in this workspace.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
              <Input
                id="timezone"
                label="Timezone"
                value={product.timezone}
                onChange={(event) =>
                  setProduct((prev) => ({
                    ...prev,
                    timezone: event.target.value,
                  }))
                }
                placeholder="UTC"
                disabled={!isAdmin}
              />
              <Input
                id="currency"
                label="Currency"
                value={product.currency}
                onChange={(event) =>
                  setProduct((prev) => ({
                    ...prev,
                    currency: event.target.value,
                  }))
                }
                placeholder="USD"
                disabled={!isAdmin}
              />
              <Input
                id="currencyKind"
                label="Currency kind"
                value={product.currencyKind}
                onChange={(event) =>
                  setProduct((prev) => ({
                    ...prev,
                    currencyKind: event.target.value,
                  }))
                }
                placeholder="normal"
                disabled={!isAdmin}
              />
              <div className="flex justify-end md:col-span-3">
                <Button type="submit" disabled={!isAdmin || isSubmitting}>
                  <FloppyDisk className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Saving…" : "Save workspace settings"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      </SettingsBody>
    </PageWrapper>
  );
}
