/**
 * General Settings Page
 *
 * Workspace identity and regional defaults, built on Kumo UI.
 * Route: /{slug}/settings
 */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { FloppyDisk } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { getOrganization, updateWorkspace } from "@/lib/api-client";
import { pageSEO } from "@/lib/seo";

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

interface FormData {
  name: string;
  slug: string;
  logo: string;
  timezone: string;
  currency: string;
  currencyKind: string;
}

function GeneralSettings() {
  const { slug } = Route.useParams();

  const { data: organization, isPending } = useQuery({
    queryKey: ["organization", slug],
    queryFn: () => getOrganization(slug),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    slug: "",
    logo: "",
    timezone: "UTC",
    currency: "BRL",
    currencyKind: "normal",
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo ?? "",
        timezone: organization.timezone || "UTC",
        currency: organization.currency || "BRL",
        currencyKind: organization.currencyKind || "normal",
      });
    }
  }, [organization]);

  const isAdmin =
    organization?.userRole === "owner" || organization?.userRole === "admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await updateWorkspace(slug, {
        name: formData.name,
        logo: formData.logo || null,
        timezone: formData.timezone,
        currency: formData.currency,
        currencyKind: formData.currencyKind,
      });

      toast.success("Workspace settings updated successfully");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update workspace settings"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isPending || !organization) {
    return null;
  }

  return (
    <PageWrapper title="General Settings">
      <form onSubmit={handleSubmit} className="grid gap-6">
        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Workspace profile
            </Text>
            <Text variant="secondary">
              Tenant identity. Brand and security settings live on their own
              pages.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Workspace name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Workspace slug</Label>
                <Input id="slug" value={formData.slug} disabled />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  value={formData.logo}
                  onChange={(e) =>
                    setFormData({ ...formData, logo: e.target.value })
                  }
                  placeholder="https://…"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </LayerCard.Primary>
        </LayerCard>

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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Input
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  placeholder="UTC"
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value })
                  }
                  placeholder="USD"
                  disabled={!isAdmin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currencyKind">Currency kind</Label>
                <Input
                  id="currencyKind"
                  value={formData.currencyKind}
                  onChange={(e) =>
                    setFormData({ ...formData, currencyKind: e.target.value })
                  }
                  placeholder="normal"
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isAdmin}>
            <FloppyDisk className="mr-2 h-4 w-4" />
            {isSubmitting ? "Saving…" : "Save workspace settings"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  );
}
