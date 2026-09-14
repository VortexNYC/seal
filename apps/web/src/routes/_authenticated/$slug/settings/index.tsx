import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { FloppyDisk } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AuthProvider,
  OrganizationProfile,
  useAuth,
} from "@vortex-api/better-auth-ui";
import { useEffect, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { betterAuthClient } from "@/lib/better-auth";
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
  const client = betterAuthClient;

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

  const isAdmin =
    organization?.userRole === "owner" || organization?.userRole === "admin";

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
      <div className="grid gap-6">
        {organization && (
          <OrganizationProfile
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

        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Regional defaults
            </Text>
            <Text variant="secondary">
              Product defaults for documents and payments in this workspace.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="currencyKind">Currency kind</Label>
                <Input
                  id="currencyKind"
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
              </div>
              <div className="flex justify-end md:col-span-3">
                <Button type="submit" disabled={!isAdmin || isSubmitting}>
                  <FloppyDisk className="mr-2 h-4 w-4" />
                  {isSubmitting ? "Saving…" : "Save workspace settings"}
                </Button>
              </div>
            </form>
          </LayerCard.Primary>
        </LayerCard>
      </div>
    </PageWrapper>
  );
}
